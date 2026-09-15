import { DEFAULT_SPOT_ID } from '../../config/env'
import { aiApi, contentApi, homeApi, watchApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { nowISO, nowTime, showError, toast } from '../../utils/format'
import { chooseImage, mediaUrl, preloadImage, uploadImage } from '../../utils/upload'
import { loadGuideSpots } from '../../utils/spotGuide'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'
import {
  addWatchItem,
  getWatchSession,
  isWatching,
  setWatchSessionId,
  startWatchSession
} from '../../utils/watchLog'
import { endWatchNow, notifyWatchBall, subscribeWatchBall } from '../../utils/watchBall'

const ASSET = 'https://www.blueakaiwu.cn/api/v1/static/assets'

const DEFAULT_ACTIVITIES = [
  { id: 'theme-science', tag: '科普', title: '潮间带科普课', desc: '认识小螃蟹和贝类朋友', theme: 'teal', icon: `${ASSET}/home/home-fish.png`, url: '/pages/knowledge/knowledge' },
  { id: 'theme-study', tag: '研学', title: '赶海研学营', desc: '跟着导师探索潮间带', theme: 'yellow', icon: `${ASSET}/home/home-hero-mascot.png`, url: '' },
  { id: 'theme-deepblue', tag: '科普', title: '深蓝百万里', desc: '探秘深海生物的世界', theme: 'banner', icon: `${ASSET}/home/home-deepblue.png`, url: '/pages/knowledge/knowledge' }
]

/** 与赶海无关的句子：天气、穿戴、泛化安全叮嘱 */
const SKIP_SENTENCE_RE = /(天气|气温|温度|\d+\s*℃|\d+\s*°|东南风|西南风|西北风|东北风|东风|南风|西风|北风|风力|风\s*\d+\s*级|轻浪|中浪|大浪|多云|晴天|阴天|小雨|中雨|大雨|阵雨|雷阵|防滑|穿鞋|雨具|雨伞|保暖|外套|体感|防晒|牵好|牵紧|大人的手|家长|大人陪|陪同|独自|湿滑|涨潮线|离岸流)/

/** 把后端整段建议拆成句，丢掉天气/穿戴/套话句，只保留潮汐与赶海时机 */
function filterAdviceBody(body: string): string {
  if (!body) return ''
  const sentences = body.match(/[^。！？!?]+[。！？!?]?/g) || []
  return sentences
    .map((s) => s.trim())
    .filter((s) => s && !SKIP_SENTENCE_RE.test(s))
    .join('')
}

/** 涨潮时间：优先后端 nextChange；缺失时用今日潮汐点位里下一个高/低潮补位 */
function nextTideText(advice: any, points: any[]): string {
  const nc = advice && advice.nextChange
  if (nc && nc.time) return `${nc.time} ${nc.label || '潮位变化'}`
  if (!Array.isArray(points) || !points.length) return ''
  const now = new Date()
  const current = now.getHours() * 60 + now.getMinutes()
  const toMin = (t: string) => {
    const parts = String(t).split(':')
    return Number(parts[0]) * 60 + Number(parts[1] || 0)
  }
  const next = points.find((p) => p && p.time && toMin(p.time) >= current)
  if (!next) return ''
  return `${next.time} ${next.type === 'high' ? '涨至最高潮' : '退到最低潮'}`
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
    place: '青岛',
    watchLabel: '开始观潮',
    watchClass: '',
    advice: {},
    recommended: [],
    recLoading: true,
    activities: DEFAULT_ACTIVITIES,
    showAdvice: false,
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
    tidePoints: []
  },

  onShow() {
    const app = getApp()
    const self = this as any
    const spotId = (app.globalData && app.globalData.spotId) || this.data.spotId
    this.setData({ spotId, place: '青岛' })
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
  },

  syncWatchBtn() {
    if (isWatching()) {
      this.setData({ watchLabel: '观潮中', watchClass: 'is-on' })
      return
    }
    this.setData({ watchLabel: '开始观潮', watchClass: '' })
  },

  /** 结束观潮：本地落记录 + 同步服务端，全局复位（按钮与悬浮球共用） */
  doEndWatch() {
    const record = endWatchNow()
    toast(record ? '已记入观潮记录' : '没有进行中的观潮')
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
      // 按钮保持“观潮中”，不做中间态切换；是否结束由弹窗确认
      wx.showModal({
        title: '结束观潮',
        content: '确认结束这次观潮吗？起止时间会写入观潮记录。',
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
    wx.showModal({
      title: '开始观潮',
      content: '确认开始这次观潮吗？将记录开始时间。',
      confirmText: '开始',
      success: (res) => {
        if (!res.confirm) return
        const startedAt = nowISO()
        startWatchSession(startedAt)
        notifyWatchBall()
        this.syncWatchBtn()
        toast('观潮已开始')
        watchApi.start({ startedAt, spotId: this.data.spotId })
          .then((data) => {
            if (data && data.id) setWatchSessionId(data.id)
          })
          .catch(() => {})
      }
    })
  },

  loadToday() {
    homeApi.today({ spotId: this.data.spotId })
      .then((data) => {
        const place = (data && data.place) || {}
        const tide = (data && data.tide) || {}
        const height = tide.currentHeightM != null ? tide.currentHeightM : 0.8
        const trend = tide.trend || 'falling'
        const app = getApp()
        if (app.globalData) {
          app.globalData.spotId = place.spotId || this.data.spotId
        }
        this.setData({
          place: '青岛',
          spotId: place.spotId || this.data.spotId,
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
    loadGuideSpots()
      .then((list) => this.setData({ recommended: (list || []).slice(0, 3) }))
      .catch(() => this.setData({ recommended: [] }))
      .finally(() => this.setData({ recLoading: false }))
  },

  /** 相关活动：以后端配置为准，接口未上线或返回为空时展示科普 / 研学两个默认主题 */
  loadActivities() {
    contentApi.activities()
      .then((list) => {
        const items = (list || []).map((it: any, i: number) => ({
          id: it.id || `activity_${i}`,
          tag: it.tag || it.category || '活动',
          title: it.title || it.name || '',
          desc: it.desc || it.subtitle || it.summary || '',
          // banner 也是 theme 取值（图当背景 + 文字叠在上面），与前端同学的上传版本一致
          theme: it.theme === 'yellow' || it.theme === 'banner' ? it.theme : 'teal',
          icon: it.image || it.imageUrl || (it.tag === '研学' ? `${ASSET}/home/home-hero-mascot.png` : `${ASSET}/home/home-fish.png`),
          url: it.url || it.linkUrl || ''
        })).filter((it: any) => it.title)
        if (items.length) this.setData({ activities: items })
      })
      .catch(() => {
        this.setData({ activities: DEFAULT_ACTIVITIES })
      })
  },

  onActivity(e: any) {
    const item = e.currentTarget.dataset.item || {}
    const url = String(item.url || '')
    // 外部网页（如公众号文章）交给 web-view 承载页；小程序不能直接跳外链
    if (/^https?:\/\//.test(url)) {
      const q = `url=${encodeURIComponent(url)}&title=${encodeURIComponent(item.title || '')}`
      wx.navigateTo({ url: `/pages/webview/webview?${q}` })
      return
    }
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

  onRefreshAdvice() {
    wx.showLoading({ title: '生成建议', mask: true })
    aiApi.tideAdvice(this.data.spotId)
      .then((raw) => {
        wx.hideLoading()
        const advice = raw || {}
        this.setData({
          advice: {
            ...advice,
            body: filterAdviceBody(advice.body),
            risingText: nextTideText(advice, this.data.tidePoints)
          },
          showAdvice: true
        })
      })
      .catch((err) => {
        // 先 hideLoading 再 showError，否则提示会被 hideLoading 一起关掉
        wx.hideLoading()
        showError(err, '出门建议失败')
      })
  },

  closeAdvice() {
    this.setData({ showAdvice: false })
  },

  onGuess() {
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
        // 候选**不自动**写进观潮记录，等用户点「就是这个物种」再记那一种。
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
    chooseImage()
      .then((filePath) => {
        this.setData({ trashImage: filePath })
        wx.showLoading({ title: '小螃蟹在看', mask: true })
        return uploadImage('speciesGuess', filePath)
      })
      .then((uploadId) => aiApi.trashGuess({ uploadId, spotId: this.data.spotId, clientTime: nowISO() }))
      .then((res) => {
        wx.hideLoading()
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
   * 「就是这个物种」：把用户确认的这一种写进观潮记录。
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
      toast('先点首页的「开始观潮」，识别结果才会记入记录')
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
    // 本地会话（必须带上完整字段，结束观潮时上报的就是它）
    addWatchItem(entry)
    // 同步到服务端
    if (session.id) {
      watchApi.addSpecies(session.id, entry).catch(() => {})
    }
    this.setData({ [`guessItems[${oi}].confirmedRank`]: cand.rank })
    toast('已记入观潮记录：' + cand.name)
  },

  /**
   * 「就是它」：把这件垃圾记进观潮记录。
   * 每件垃圾各记一条，重复点同一件只记一次。
   */
  onConfirmTrash(e: any) {
    const oi = Number(e.currentTarget.dataset.oi)
    const item = (this.data.trashItems as TrashItem[])[oi]
    if (!item || item.confirmed) return
    const session = getWatchSession()
    if (!session) {
      toast('先点首页的「开始观潮」，识别结果才会记入记录')
      return
    }
    const entry = {
      name: item.name,
      time: nowTime(),
      kind: 'trash' as const,
      category: item.category,
      categoryLabel: item.categoryLabel,
      label: item.label,
      count: item.count
    }
    addWatchItem(entry)
    if (session.id) {
      watchApi.addSpecies(session.id, entry).catch(() => {})
    }
    this.setData({ [`trashItems[${oi}].confirmed`]: true })
    toast('已记入观潮记录：' + item.name)
  },

  closeGuess() {
    this.setData({ showGuess: false, guessItems: [] })
  },

  noop() {}
})
