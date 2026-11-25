import { DEFAULT_SPOT_ID } from '../../config/env'
import { achieveApi, aiApi, contentApi, homeApi, watchApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { nowISO, nowTime, showError, toast } from '../../utils/format'
import { chooseImage, mediaUrl, preloadImage, uploadImage } from '../../utils/upload'
import { getCachedLocation, haversineM, loadGuideSpots, rankWatchSpots, requestLocation } from '../../utils/spotGuide'
import { enableShareMenu } from '../../utils/share'
import { getRegion, getRegionKey, getSavedSpotId, saveSpotId } from '../../utils/region'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'
import { shouldShowOnboarding, markOnboardingCompleted, isOnboarding, getOnboardingIndex } from '../../utils/onboardingStore'
import { ONBOARDING_STEPS } from '../../utils/onboardingSteps'
import {
  addWatchItem,
  getWatchSession,
  hasTrashToday,
  isWatching,
  setWatchSessionId,
  startWatchSession,
  WatchSpot
} from '../../utils/watchLog'
import { endWatchNow, notifyWatchBall, subscribeWatchBall } from '../../utils/watchBall'

const ASSET = 'https://www.blueakaiwu.cn/api/v1/static/assets'

const DEFAULT_ACTIVITIES = [
  { id: 'theme-science', tag: '小科普', title: '潮间带小科普', desc: '认识小螃蟹和贝类朋友', theme: 'teal', icon: `${ASSET}/home/home-fish.png`, url: '/pages/knowledge/knowledge' },
  { id: 'theme-study', tag: '研学', title: '赶海研学营', desc: '跟着导师探索潮间带', theme: 'yellow', icon: `${ASSET}/home/home-hero-mascot.png`, url: '' },
  { id: 'theme-deepblue', tag: '科普', title: '深蓝百万里', desc: '全民参与的海洋科学十年行动', theme: 'banner', icon: `${ASSET}/home/home-deepblue.png`, appId: 'wxc625ddd20a55f6cd', miniPath: '' }
]

/**
 * 跳第三方小程序的活动：后端 /activities 暂未下发 appId，按标题补全，
 * 保证首页「深蓝百万里」banner 能跳到官方小程序；接口补上 appId 后自动以接口值为准。
 */
const MINI_APP_BY_TITLE: Record<string, { appId: string; miniPath: string }> = {
  '深蓝百万里': { appId: 'wxc625ddd20a55f6cd', miniPath: '' }
}

type GuessCandidate = {
  rank: number
  name: string
  latinName?: string
  probability: number
  probabilityText?: string
  confidenceLabel?: string
  reason?: string
  speciesId?: string | null
  inEncyclopedia?: boolean
  wikiPath?: string | null
}

/** 一个物品（图里一只生物）及其自己的候选列表 */
type GuessItem = {
  key: string
  index: number
  label: string
  count: number
  candidates: GuessCandidate[]
  /** 渲染用：默认只放首选，展开后是全部。WXML 里不做条件计算 */
  visibleCandidates: GuessCandidate[]
  expanded: boolean
  confirmedRank: number
  topName: string
}

/** 一件垃圾：只有一个结论，没有备选 */
type TrashItem = {
  key: string
  index: number
  label: string
  count: number
  name: string
  category: string
  categoryLabel: string
  probability: number
  probabilityText: string
  reason: string
  tip: string
  hazardNote: string
  confirmed: boolean
}

/**
 * 把物种识别结果整理成「每个物品一条」的渲染结构。
 *
 * 后端新结构是 items[]（每项 = 图里一个不同的生物，各自带候选）；
 * 老记录（扁平 candidates）兜底成单物品，保证历史 guessId 也打得开。
 * 渲染用的候选列表在这里预计算好，WXML 里就不用写任何条件逻辑。
 */
function normalizeGuessItems(raw: any): GuessItem[] {
  let list: any[] = Array.isArray(raw && raw.items) ? raw.items.slice() : []
  if (!list.length) {
    const legacy = Array.isArray(raw && raw.candidates) ? raw.candidates : []
    if (legacy.length) list = [{ label: '照片里的生物', candidates: legacy }]
  }
  return list
    .map((it: any, i: number) => {
      const candidates: GuessCandidate[] = (Array.isArray(it.candidates) ? it.candidates : []).slice(0, 3)
      return {
        key: `obj_${i + 1}`,
        index: i + 1,
        label: it.label || `发现 ${i + 1}`,
        count: Number(it.count) > 1 ? Number(it.count) : 1,
        candidates,
        visibleCandidates: candidates.slice(0, 1),
        expanded: false,
        confirmedRank: 0,
        topName: (candidates[0] && candidates[0].name) || ''
      }
    })
    .filter((it: GuessItem) => it.candidates.length > 0)
}

/** 垃圾识别结果：每件一个结论 */
function normalizeTrashItems(raw: any): TrashItem[] {
  const list = Array.isArray(raw && raw.items) ? raw.items : []
  return list
    .map((it: any, i: number) => ({
      key: `trash_${i + 1}`,
      index: i + 1,
      label: it.label || `垃圾 ${i + 1}`,
      count: Number(it.count) > 1 ? Number(it.count) : 1,
      name: it.name || '',
      category: it.category || 'other',
      categoryLabel: it.categoryLabel || '其他垃圾',
      probability: Number(it.probability) || 0,
      probabilityText: it.probabilityText || '',
      reason: it.reason || '',
      tip: it.tip || '',
      hazardNote: it.hazardNote || '',
      confirmed: false
    }))
    .filter((it: TrashItem) => !!it.name)
}

Page({
  lastGuessId: '',
  _unsubWatch: null as (() => void) | null,
  _lastWatching: false,

  data: {
    // 顶部地址：展示当前地区（青岛 / 海南），点击可切换或使用当前位置自动判断
    place: getRegion().label,
    regionKey: getRegionKey(),
    watchLabel: '开始赶海',
    watchClass: '',
    recommended: [],
    recLoading: true,
    activities: DEFAULT_ACTIVITIES,
    activityIndex: 0,
    showGuess: false,
    showTrash: false,
    trash: {},
    trashItems: [] as TrashItem[],
    trashImage: '',
    guess: {},
    guessItems: [] as GuessItem[],
    guessImage: '',
    spotId: DEFAULT_SPOT_ID,
    tideHeightM: 0.8,
    tideTrend: 'falling',
    tidePoints: [],
    showOnboarding: false,
    onbStartIndex: 0,
    // 新手教程当前锚点的测量结果（{index, rect}，rect=null 表示居中步）
    onbRect: null as any,
    // 开始赶海前的地点选择弹窗
    spotPickerVisible: false,
    watchSpots: [] as any[],
    watchSpotsLoading: false
  },

  onShow() {
    const app = getApp()
    const self = this as any
    enableShareMenu()
    const savedSpot = getSavedSpotId()
    const spotId = savedSpot || (getRegionKey() === 'qingdao' ? DEFAULT_SPOT_ID : '')
    if (app.globalData) app.globalData.spotId = spotId
    this.setData({ spotId })
    // 从地区切换页返回时，清掉旧地区的推荐，等新数据回来
    if (this.refreshPlace()) {
      this.setData({ recommended: [] })
    }
    // 新手教程：首次启动 或 跨页续接到 home
    if (isOnboarding()) {
      const idx = getOnboardingIndex()
      const step = ONBOARDING_STEPS[idx]
      if (step && step.tab === 'home') {
        this.setData({ showOnboarding: true, onbStartIndex: idx })
      } else {
        // 不属于本页的步骤：隐藏，等待目标页接管
        this.setData({ showOnboarding: false })
      }
    } else if (shouldShowOnboarding()) {
      // 首次启动：从第 0 步开始
      this.setData({ showOnboarding: true, onbStartIndex: 0 })
    }
    if (!self._unsubWatch) {
      self._lastWatching = isWatching()
      self._unsubWatch = subscribeWatchBall((state) => {
        if (state.watching !== self._lastWatching) {
          self._lastWatching = state.watching
          this.syncWatchBtn()
        }
      })
    }
    this.syncWatchBtn()
    this.loadToday()
    this.loadRecommended()
    this.loadActivities()
    this.preloadEncyclopedia()
    // 预加载已在 app.onLaunch 启动（与首页请求、图片并行），这里不再重复触发
    flushUnlocks(this)
    // 从潮汐表浮标或「我的服务 → 生态净滩」跳回首页：自动拉起对应的拍照识别
    const pendingAi = wx.getStorageSync('home_open_guess')
      ? 'guess'
      : (wx.getStorageSync('home_open_trash') ? 'trash' : '')
    if (pendingAi) {
      wx.removeStorageSync('home_open_guess')
      wx.removeStorageSync('home_open_trash')
      setTimeout(() => {
        if (pendingAi === 'guess') this.onGuess()
        else this.onTrashGuess()
      }, 350)
    }
  },

  /** 首页主按钮：直接看当前位置最近的潮汐表（没保存过点位时由潮汐表页自己选最近的点） */
  goTide() {
    // 先选一个赶海点，再进入对应点位的潮汐表
    this.openSpotPicker()
  },

  onShareAppMessage() {
    return { title: '追潮记 · 赶海看潮汐', path: '/pages/home/home' }
  },

  syncWatchBtn() {
    if (isWatching()) {
      this.setData({ watchLabel: '赶海中', watchClass: 'is-on' })
      return
    }
    this.setData({ watchLabel: '开始赶海', watchClass: '' })
  },

  /** 新手教程关闭回调：写完成标记并隐藏 */
  onOnboardingFinish() {
    markOnboardingCompleted()
    this.setData({ showOnboarding: false, onbRect: null })
  },

  /**
   * 教程组件请求定位某一步：先把锚点滚动到可视区合适位置，
   * 再测量 boundingClientRect 回传给组件做高亮/气泡定位。
   */
  onOnboardingLocate(e: any) {
    const index = Number((e && e.detail && e.detail.index) || 0)
    const step = ONBOARDING_STEPS[index]
    if (!step) return

    // 跨页：步骤不属于 home → 隐藏本页组件并跳转
    if (step.tab && step.tab !== 'home') {
      this.setData({ showOnboarding: false })
      const url = step.tab === 'achieve' ? '/pages/achieve/achieve' : '/pages/profile/profile'
      wx.switchTab({ url })
      return
    }

    if (!step.selector) {
      wx.pageScrollTo({ scrollTop: 0, duration: 0 })
      this.setData({ onbRect: { index, rect: null } })
      return
    }
    const winH = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowHeight
    let retries = 0
    let lastScrollTop = -1

    const doMeasure = () => {
      const query = wx.createSelectorQuery()
      query.selectViewport().scrollOffset()
      query.select(step.selector as string).boundingClientRect()
      query.exec((res: any[]) => {
        const offset = (res[0] && res[0].scrollTop) || 0
        const rect = res[1]
        if (!rect) {
          // 锚点测不到（可能还没渲染）：重试几次，仍失败则退化为居中
          if (retries++ < 5) { setTimeout(doMeasure, 150); return }
          this.setData({ onbRect: { index, rect: null } })
          return
        }
        // 只要求元素顶部在视口合理区间内，不要求完整可见（高卡片 bottom 会超出但没关系）
        if (rect.top < 40 || rect.top > winH * 0.55) {
          // 已滚到底（scrollTop 不再变化，swiper 等底部元素常见）：接受当前位置
          if (offset === lastScrollTop) {
            this.setData({ onbRect: { index, rect } })
            return
          }
          lastScrollTop = offset
          const absTop = offset + rect.top
          wx.pageScrollTo({ scrollTop: Math.max(0, absTop - 120), duration: 0 })
          if (retries++ < 8) { setTimeout(doMeasure, 300); return }
        }
        this.setData({ onbRect: { index, rect } })
      })
    }
    doMeasure()
  },

  /** 结束赶海：本地落记录 + 同步服务端，全局复位（按钮与悬浮球共用） */
  doEndWatch() {
    const record = endWatchNow()
    toast(record ? '已记入赶海记录' : '没有进行中的赶海')
    this.syncWatchBtn()
  },

  onUnload() {
    const self = this as any
    if (self._unsubWatch) {
      self._unsubWatch()
      self._unsubWatch = null
    }
  },

  onWatchToggle() {
    if (isWatching()) {
      // 按钮保持“赶海中”，不做中间态切换；是否结束由弹窗确认
      wx.showModal({
        title: '结束赶海',
        content: '确认结束这次赶海吗？起止时间会写入赶海记录。',
        confirmText: '结束',
        cancelText: '继续',
        success: (res) => {
          if (!res.confirm) {
            this.syncWatchBtn()
            return
          }
          this.doEndWatch()
        }
      })
      return
    }
    // 未开始：开始新赶海要写服务端记录，后端已要求登录；
    // 先拦在选点之前，避免用户选完地点/拍完照才 401。
    // 已有本地会话的“结束赶海”不受影响，仍可先结束。
    if (!requireLogin()) return
    this.openSpotPicker()
  },

  /** 打开地点选择弹窗，并按距离+热度加载推荐赶海点 */
  openSpotPicker() {
    this.setData({ spotPickerVisible: true, watchSpots: [], watchSpotsLoading: true })
    loadGuideSpots()
      .then((list) => {
        this.setData({ watchSpots: rankWatchSpots(list, 5), watchSpotsLoading: false })
      })
      .catch(() => {
        this.setData({ watchSpotsLoading: false })
      })
  },

  closeSpotPicker() {
    this.setData({ spotPickerVisible: false })
  },

  /** 选中一个推荐点位 → 进入该点位的潮汐表 */
  onPickWatchSpot(e: any) {
    const row = this.data.watchSpots[Number(e.currentTarget.dataset.index)]
    if (!row) return
    this.setData({ spotPickerVisible: false })
    wx.navigateTo({ url: `/pages/tide/tide?spotId=${row.id}` })
  },

  /** 打开赶海地图，直接进入拖动选点模式 */
  goSpotMap() {
    this.setData({ spotPickerVisible: false })
    wx.navigateTo({ url: '/pages/spot-map/spot-map?pick=1' })
  },

  /** 在微信内置地图上自选点位（gcj02 坐标，与潮汐接口一致） */
  onChooseCustomSpot() {
    const cached = getCachedLocation() || ({} as any)
    wx.chooseLocation({
      latitude: cached.lat,
      longitude: cached.lng,
      success: (res: any) => {
        if (!res || (!res.name && !res.address)) return
        const spot: WatchSpot = {
          name: res.name || res.address || '自选点位',
          latitude: res.latitude,
          longitude: res.longitude,
          source: 'custom'
        }
        this.checkBeachArea(res.latitude, res.longitude).then((nearBeach) => {
          if (nearBeach) {
            this.beginWatch(spot)
            return
          }
          wx.showModal({
            title: '这里可能不是海边',
            content: '你选的位置离已知赶海点较远，可能不在潮间带。为了安全，建议回到赶海点附近再开始。',
            confirmText: '仍要继续',
            cancelText: '重新选择',
            success: (r) => {
              if (r.confirm) this.beginWatch(spot)
              else this.onChooseCustomSpot()
            }
          })
        })
      },
      fail: (err: any) => {
        const msg = String((err && err.errMsg) || '')
        if (/auth|deny|permission/i.test(msg)) {
          wx.showModal({
            title: '需要位置权限',
            content: '自选地点要先授权位置信息，去设置里开启后再试。',
            confirmText: '知道了',
            showCancel: false
          })
        }
        // 用户主动取消时不提示
      }
    })
  },

  /**
   * 自选点是否在海边：没有海陆边界数据，用「离已知赶海点不超过 3km」做近似判断。
   * 点位数据为空时不做武断拦截。
   */
  checkBeachArea(lat: number, lng: number): Promise<boolean> {
    if (typeof lat !== 'number' || typeof lng !== 'number') return Promise.resolve(true)
    return loadGuideSpots(true)
      .then((list) => {
        const rows = (list || []).filter((item) => item.latitude && item.longitude)
        if (!rows.length) return true
        const nearest = Math.min.apply(null, rows.map((item) => (
          haversineM(lat, lng, item.latitude, item.longitude)
        )))
        return nearest <= 3000
      })
      .catch(() => true)
  },

  /** 选定地点后开始赶海：写本地会话（悬浮球随之出现）+ 上报服务端 */
  beginWatch(spot: WatchSpot) {
    const startedAt = nowISO()
    this.setData({ spotPickerVisible: false })
    startWatchSession(startedAt, undefined, spot)
    notifyWatchBall()
    this.syncWatchBtn()
    toast(`已在${spot.name}开始赶海`)
    watchApi.start({
      startedAt,
      spotId: spot.spotId || this.data.spotId,
      spotName: spot.name,
      latitude: spot.latitude,
      longitude: spot.longitude,
      spotSource: spot.source
    })
      .then((data) => {
        if (data && data.id) setWatchSessionId(data.id)
      })
      .catch(() => {})
  },

  /** 顶部地址芯片展示当前地区；返回 true 表示地区相比上次发生了变化 */
  refreshPlace(): boolean {
    const key = getRegionKey()
    const changed = key !== this.data.regionKey
    this.setData({ place: getRegion().label, regionKey: key })
    return changed
  },

  /** 点击顶部地址：进入地区切换页 */
  onTapPlace() {
    wx.navigateTo({ url: '/pages/region-select/region-select' })
  },

  loadToday() {
    // 没有选中点位时只传当前地区的默认城市，由后端返回该城市的默认点位
    const params: Record<string, any> = this.data.spotId
      ? { spotId: this.data.spotId }
      : { city: getRegion().defaultCity }
    homeApi.today(params)
      .then((data) => {
        const place = (data && data.place) || {}
        const tide = (data && data.tide) || {}
        const height = tide.currentHeightM != null ? tide.currentHeightM : 0.8
        const trend = tide.trend || 'falling'
        const spotId = place.spotId || this.data.spotId
        if (spotId) saveSpotId(spotId)
        const app = getApp()
        if (app.globalData) app.globalData.spotId = spotId
        this.setData({
          spotId,
          tideHeightM: height,
          tideTrend: trend,
          tidePoints: Array.isArray(tide.points) ? tide.points : []
        })
      })
      .catch(() => {})
  },

  preloadEncyclopedia() {
    contentApi.encyclopedia({ page: 1, pageSize: 50 })
      .then((res) => {
        const list = res.list || []
        list.forEach((it: any) => {
          preloadImage(mediaUrl(it.coverUrl || ''))
        })
      })
      .catch(() => {})
  },

  loadRecommended() {
    this.setData({ recLoading: true })
    // 静默加载：只用已缓存定位，不在这里申请位置权限（否则一进首页就弹授权）
    const apply = () => {
      loadGuideSpots(true)
        .then((list) => this.setData({ recommended: (list || []).slice(0, 3) }))
        .catch(() => this.setData({ recommended: [] }))
        .finally(() => this.setData({ recLoading: false }))
    }
    if (getCachedLocation()) {
      apply()
      return
    }
    // 不在首页主动弹定位授权。只有用户此前已经授权过，才静默补一次坐标；
    // 没授权就先用「距离待测」，等用户点顶部定位再说。
    wx.getSetting({
      success: (res: any) => {
        if (res.authSetting && res.authSetting['scope.userLocation'] === true) {
          requestLocation()
            .then(() => apply())
            .catch(() => apply())
        } else {
          apply()
        }
      },
      fail: () => apply()
    })
  },

  /** 相关活动：以后端配置为准，接口未上线或返回为空时展示科普 / 研学两个默认主题 */
  loadActivities() {
    contentApi.activities()
      .then((list) => {
        const items = (list || []).map((it: any, i: number) => {
          const title = it.title || it.name || ''
          const mini = MINI_APP_BY_TITLE[title]
          return {
            id: it.id || `activity_${i}`,
            tag: it.tag || it.category || '活动',
            title,
            desc: it.desc || it.subtitle || it.summary || '',
            // banner 也是 theme 取值（图当背景 + 文字叠在上面），与前端同学的上传版本一致
            theme: it.theme === 'yellow' || it.theme === 'banner' ? it.theme : 'teal',
            icon: it.image || it.imageUrl || (it.tag === '研学' ? `${ASSET}/home/home-hero-mascot.png` : `${ASSET}/home/home-fish.png`),
            url: it.url || it.linkUrl || '',
            // 跳第三方小程序（如深蓝百万里官方小程序）：优先后端 appId，缺失时按标题兜底
            appId: it.appId || it.miniAppId || (mini ? mini.appId : ''),
            miniPath: it.miniPath || it.appPath || (mini ? mini.miniPath : '')
          }
        }).filter((it: any) => it.title)
        if (items.length) this.setData({ activities: items })
      })
      .catch(() => {
        this.setData({ activities: DEFAULT_ACTIVITIES })
      })
  },

  /** 活动轮播切换时更新指示器 */
  onActivityChange(e: any) {
    this.setData({ activityIndex: e.detail.current })
  },

  /**
   * 「深蓝百万里」是用户点链接的动作，服务端看不见，只能前端上报解锁成就。
   * 先上报再跳转，但不阻塞跳转；未登录会 401，静默忽略。
   */
  reportDeepBlueMileage(title: string) {
    if (title !== '深蓝百万里') return
    achieveApi.report('deepblue_mileage')
      .then((res: any) => {
        enqueueUnlocks((res && res.unlockedMedalIds) || [], 'report')
        flushUnlocks(this)
      })
      .catch(() => {})
  },

  onActivity(e: any) {
    const item = e.currentTarget.dataset.item || {}
    this.reportDeepBlueMileage(String(item.title || ''))
    // 跳第三方小程序（如深蓝两万里官方小程序），必须由用户点击触发
    if (item.appId) {
      wx.navigateToMiniProgram({
        appId: String(item.appId),
        path: item.miniPath ? String(item.miniPath) : undefined,
        fail: (err: any) => {
          if (err && String(err.errMsg || '').indexOf('cancel') >= 0) return
          toast('暂时无法打开，请稍后再试')
        }
      })
      return
    }
    const url = String(item.url || '')
    if (url && /^\/pages\//.test(url)) {
      wx.navigateTo({ url })
      return
    }
    toast('活动即将开放，敬请期待')
  },

  onSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  goRecommend() {
    wx.navigateTo({ url: '/pages/spot-guide/spot-guide' })
  },

  /** 点了候选：只有收录进图鉴的才有 speciesId，能跳图鉴详情 */
  openWiki(e: any) {
    const item = e.currentTarget.dataset.item || {}
    const id = item.speciesId
    if (!id) {
      toast('这个还没收录进图鉴')
      return
    }
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${id}` })
  },

  onGuess() {
    // 上传和 AI 识别都要求登录；先拦截，避免用户拍完照才 401
    if (!requireLogin()) return
    chooseImage()
      .then((filePath) => {
        this.setData({ guessImage: filePath })
        wx.showLoading({ title: '小螃蟹在看', mask: true })
        return uploadImage('speciesGuess', filePath)
      })
      .then((uploadId) => {
        // 带上定位：后端据此过滤掉当地不可能出现的物种（如海边不显示淡水鱼）
        const app = getApp()
        const g = (app && app.globalData) || {}
        return aiApi.speciesGuess({
          uploadId,
          spotId: this.data.spotId,
          tideHeightM: this.data.tideHeightM,
          tideTrend: this.data.tideTrend,
          clientTime: nowISO(),
          lat: g.userLat,
          lng: g.userLng
        })
      })
      .then((guess) => {
        this.lastGuessId = guess && guess.guessId
        // 图里有几个生物就渲染几条，每条默认只展示自己的首选，其余折叠；
        // 候选**不自动**写进赶海记录，等用户点「就是这个物种」再记那一种。
        // 必须先关掉 loading：成功分支漏了这句的话，弹窗出来了转圈还一直转。
        wx.hideLoading()
        this.setData({
          showGuess: true,
          guess: guess || {},
          guessItems: normalizeGuessItems(guess)
        })
        enqueueUnlocks((guess && guess.unlockedMedalIds) || [], 'guess')
        flushUnlocks(this)
      })
      .catch((err) => {
        // 先关掉 loading 再弹提示：showToast 与 showLoading 共用同一个原生视图，
        // 顺序反过来的话 hideLoading 会把刚弹出的 toast 一起关掉，用户什么都看不到。
        wx.hideLoading()
        if (err && err.message === 'cancel') return
        if (err && err.code === 40101) {
          requireLogin()
          return
        }
        showError(err, '识别失败')
      })
  },

  /** 垃圾识别：拍照 → 上传 → 识物 + 判定类别（可回收 / 有害 / 厨余 / 其他） */
  onTrashGuess() {
    if (!requireLogin()) return
    chooseImage()
      .then((filePath) => {
        this.setData({ trashImage: filePath })
        wx.showLoading({ title: '小螃蟹在看', mask: true })
        return uploadImage('speciesGuess', filePath)
      })
      .then((uploadId) => aiApi.trashGuess({ uploadId, spotId: this.data.spotId, clientTime: nowISO() }))
      .then((res) => {
        wx.hideLoading()
        // 判定为垃圾时可能解锁「深蓝小卫士」（medal_14）
        enqueueUnlocks((res && res.unlockedMedalIds) || [], 'trash')
        flushUnlocks(this)
        this.setData({ showTrash: true, trash: res || {}, trashItems: normalizeTrashItems(res) })
      })
      .catch((err) => {
        // 同 onGuess：先 hideLoading 再 showError，否则提示会被 hideLoading 吞掉
        wx.hideLoading()
        if (err && err.message === 'cancel') return
        if (err && err.code === 40101) {
          requireLogin()
          return
        }
        showError(err, '识别失败')
      })
  },

  closeTrash() {
    this.setData({ showTrash: false, trashItems: [] })
  },

  /** 展开 / 收起某一个物品的其他候选（每个物品独立，不再全局一刀切） */
  toggleItemAll(e: any) {
    const oi = Number(e.currentTarget.dataset.oi)
    const item = (this.data.guessItems as GuessItem[])[oi]
    if (!item) return
    const expanded = !item.expanded
    this.setData({
      [`guessItems[${oi}].expanded`]: expanded,
      [`guessItems[${oi}].visibleCandidates`]: expanded ? item.candidates : item.candidates.slice(0, 1)
    })
  },

  /**
   * 「就是这个物种」：把用户确认的这一种写进赶海记录。
   * 图里有几个生物就能各记一条；同一个生物只能确认一次。
   */
  onConfirmSpecies(e: any) {
    const oi = Number(e.currentTarget.dataset.oi)
    const cand = e.currentTarget.dataset.item || {}
    const item = (this.data.guessItems as GuessItem[])[oi]
    if (!item || !cand.name || !cand.rank) return
    if (item.confirmedRank) {
      if (item.confirmedRank !== cand.rank) toast('这一条已经记过了，看看别的发现')
      return
    }
    const session = getWatchSession()
    if (!session) {
      toast('先到潮汐表页开始赶海，识别结果才会记录')
      return
    }
    const entry = {
      name: cand.name,
      time: nowTime(),
      kind: 'species' as const,
      speciesId: cand.speciesId || '',
      guessId: this.lastGuessId,
      label: item.label,
      count: item.count
    }
    // 本地会话（必须带上完整字段，结束赶海时上报的就是它）
    addWatchItem(entry)
    // 同步到服务端。响应会带回「本次新点亮的图鉴物种」—— 后端只在这个物种此前
    // 没点亮过时才返回它，所以直接拿去弹庆祝弹窗即可，前端不用另外去重。
    if (session.id) {
      watchApi.addSpecies(session.id, entry)
        .then((res: any) => {
          // 集齐「螺」等勋章会随本次记入一起返回
          enqueueUnlocks((res && res.unlockedMedalIds) || [], 'watch')
          const lit = res && res.newlyLitSpecies
          if (lit) {
            enqueueUnlocks([{
              medalId: lit.id,   // 解锁队列按 medalId 去重
              id: lit.id,
              title: lit.name,
              description: '已收录进你的图鉴',
              icon: mediaUrl(lit.coverUrl || ''),
              source: 'species'
            }], 'species')
          }
          flushUnlocks(this)
        })
        .catch(() => {})
    }
    this.setData({ [`guessItems[${oi}].confirmedRank`]: cand.rank })
    toast('已记入赶海记录：' + cand.name)
  },

  /**
   * 「就是它」：把这件垃圾记进赶海记录。
   * 每件垃圾各记一条，重复点同一件只记一次。
   */
  onConfirmTrash(e: any) {
    const oi = Number(e.currentTarget.dataset.oi)
    const item = (this.data.trashItems as TrashItem[])[oi]
    if (!item || item.confirmed) return
    const session = getWatchSession()
    if (!session) {
      toast('先到潮汐表页开始赶海，识别结果才会记录')
      return
    }
    // 垃圾每天只允许记一次（拍照识别的生物不受限制）。
    // 本地先拦一道是为了点完立刻有反馈；服务端 watch.py 里还会再拦一次，
    // 防止换设备或清缓存绕过。
    if (hasTrashToday()) {
      toast('今天已经记过一次垃圾了，明天再来捡吧')
      return
    }
    const entry = {
      name: item.name,
      time: nowTime(),
      kind: 'trash' as const,
      category: item.category,
      categoryLabel: item.categoryLabel,
      label: item.label,
      count: item.count,
      // 这张照片的垃圾总量档位，赶海记录里要展示「垃圾量」
      amount: (this.data.trash as any)?.amount || ''
    }
    const done = () => {
      this.setData({ [`trashItems[${oi}].confirmed`]: true })
      toast('已记入赶海记录：' + item.name)
    }
    // 有服务端会话就先问服务端：它拒了（今日已记过）就不写本地，
    // 免得本地留一条服务端没有的记录，结束后合并时又对不上。
    if (session.id) {
      watchApi.addSpecies(session.id, entry)
        .then((res: any) => {
          if (res && res.trashDailyLimit) {
            toast('今天已经记过一次垃圾了，明天再来捡吧')
            return
          }
          enqueueUnlocks((res && res.unlockedMedalIds) || [], 'watch')
          flushUnlocks(this)
          addWatchItem(entry)
          done()
        })
        .catch(() => {
          // 网络失败也记本地，保证这次赶海的收获不丢
          addWatchItem(entry)
          done()
        })
      return
    }
    addWatchItem(entry)
    done()
  },

  closeGuess() {
    this.setData({ showGuess: false, guessItems: [] })
  },

  /**
   * 识别结果弹窗右上角的图鉴入口。
   * 刻意不关弹窗：用户去图鉴看完返回时，这次的识别结果还在，可以接着确认物种。
   */
  goWiki() {
    wx.navigateTo({ url: '/pages/wiki/wiki' })
  },

  noop() {}
})
