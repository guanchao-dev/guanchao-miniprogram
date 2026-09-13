import { DEFAULT_SPOT_ID } from '../../config/env'
import { aiApi, contentApi, homeApi, watchApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { nowISO, nowTime, showError, toast } from '../../utils/format'
import { chooseImage, mediaUrl, preloadImage, uploadImage } from '../../utils/upload'
import { loadGuideSpots } from '../../utils/spotGuide'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'
import {
  addWatchSpecies,
  getWatchSession,
  isWatching,
  setWatchSessionId,
  startWatchSession
} from '../../utils/watchLog'
import { endWatchNow, notifyWatchBall, subscribeWatchBall } from '../../utils/watchBall'

const ASSET = 'https://www.blueakaiwu.cn/api/v1/static/assets'

const DEFAULT_ACTIVITIES = [
  { id: 'theme-science', tag: '科普', title: '潮间带科普课', desc: '认识小螃蟹和贝类朋友', theme: 'teal', icon: `${ASSET}/home/home-fish.png`, url: '/pages/knowledge/knowledge' },
  { id: 'theme-study', tag: '研学', title: '赶海研学营', desc: '跟着导师探索潮间带', theme: 'yellow', icon: `${ASSET}/home/home-hero-mascot.png`, url: '' }
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
    showAllGuess: false,
    guess: {},
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
          theme: it.theme === 'yellow' ? 'yellow' : 'teal',
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
    if (item.url && /^\/pages\//.test(item.url)) {
      wx.navigateTo({ url: item.url })
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
      .catch((err) => showError(err, '出门建议失败'))
      .finally(() => wx.hideLoading())
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
        // 默认只展示概率最高的那一个，其余折叠
        this.setData({ showGuess: true, guess: guess || {}, showAllGuess: false })
        const hits = (guess && guess.candidates) || []
        hits.slice(0, 3).forEach((item: any) => {
          if (item && item.name) {
            addWatchSpecies(item.name, nowTime())
            const session = getWatchSession()
            if (session && session.id) {
              watchApi.addSpecies(session.id, {
                name: item.name,
                time: nowTime(),
                speciesId: item.speciesId || '',
                guessId: guess && guess.guessId
              }).catch(() => {})
            }
          }
        })
        enqueueUnlocks((guess && guess.unlockedMedalIds) || [], 'guess')
        flushUnlocks(this)
      })
      .catch((err) => {
        if (err && err.message === 'cancel') return
        if (err && err.code === 40101) {
          requireLogin()
          return
        }
        showError(err, '识别失败')
      })
      .finally(() => wx.hideLoading())
  },

  /** 展开 / 收起其余候选 */
  toggleGuessAll() {
    this.setData({ showAllGuess: !this.data.showAllGuess })
  },

  closeGuess() {
    this.setData({ showGuess: false, showAllGuess: false })
  },

  noop() {}
})
