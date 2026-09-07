import { DEFAULT_SPOT_ID } from '../../config/env'
import { aiApi, contentApi, homeApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { nowISO, showError, toast, trendText } from '../../utils/format'
import { chooseImage, mediaUrl, preloadImage, uploadImage } from '../../utils/upload'
import { drawTideChart, normalizeTidePoints, TidePoint } from '../../utils/tideChart'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'

const FEATURES = [
  { title: '潮汐日历', icon: '/assets/home/home-calendar.png', tone: 'mint' },
  { title: '附近赶海点', icon: '/assets/home/home-nearby.png', tone: 'sky' },
  { title: '海洋图鉴', icon: '/assets/home/home-fish.png', tone: 'yellow' },
  { title: '赶海装备', icon: '/assets/home/home-gear.png', tone: 'pink' }
]

const QUIZ_FALLBACK = [
  { id: 'quiz_tide_intro', title: '潮汐入门', icon: '/assets/home/home-quiz1.png', color: '#34B8C5' },
  { id: 'quiz_intertidal', title: '潮间带生物', icon: '/assets/home/home-quiz2.png', color: '#1888BF' },
  { id: 'quiz_safety', title: '安全观察', icon: '/assets/home/home-quiz3.png', color: '#F6D081' }
]

const FEATURE_ROUTES: Record<string, string> = {
  '潮汐日历': '/pages/calendar/calendar',
  '附近赶海点': '/pages/spots/spots',
  '海洋图鉴': '/pages/wiki/wiki',
  '赶海装备': '/pages/gear/gear'
}

Page({
  lastGuessId: '',
  tidePoints: [] as TidePoint[],

  data: {
    place: '青岛 · 石老人',
    heroDesc: '正在读取今日潮汐…',
    tideTag: '加载中',
    advice: {},
    features: FEATURES,
    quizzes: QUIZ_FALLBACK,
    loggedIn: false,
    showGuess: false,
    guess: {},
    guessImage: '',
    spotId: DEFAULT_SPOT_ID,
    tideHeightM: 0.8,
    tideTrend: 'falling'
  },

  onReady() {
    this.renderTide()
  },

  onShow() {
    const app = getApp()
    const spotId = (app.globalData && app.globalData.spotId) || this.data.spotId
    const place = (app.globalData && app.globalData.placeName) || this.data.place
    this.setData({ loggedIn: isLoggedIn(), spotId, place })
    this.loadToday()
    this.loadQuizzes()
    this.preloadEncyclopedia()
    flushUnlocks(this)
  },

  renderTide() {
    const points = this.tidePoints && this.tidePoints.length
      ? this.tidePoints
      : normalizeTidePoints([])
    drawTideChart(this, points, this.data.tideHeightM)
  },

  loadToday() {
    homeApi.today({ spotId: this.data.spotId })
      .then((data) => {
        const place = (data && data.place) || {}
        const tide = (data && data.tide) || {}
        const advice = (data && data.advice) || {}
        const points = normalizeTidePoints(tide.hourly && tide.hourly.length ? tide.hourly : (tide.points || []))
        const height = tide.currentHeightM != null ? tide.currentHeightM : 0.8
        const trend = tide.trend || 'falling'
        this.tidePoints = points
        const app = getApp()
        if (app.globalData) {
          app.globalData.spotId = place.spotId || this.data.spotId
          app.globalData.placeName = place.name || this.data.place
        }
        this.setData({
          place: place.name || this.data.place,
          spotId: place.spotId || this.data.spotId,
          heroDesc: advice.headline || `当前潮高约 ${height}m · ${trendText(trend)}`,
          tideTag: advice.fallback ? '演示/降级' : '今日潮汐',
          advice,
          tideHeightM: height,
          tideTrend: trend
        }, () => this.renderTide())
      })
      .catch((err) => {
        this.tidePoints = normalizeTidePoints([])
        this.setData({
          heroDesc: '当前潮高约 0.8m · 适宜观察',
          tideTag: '离线演示'
        }, () => this.renderTide())
        showError(err, '首页数据加载失败')
      })
  },

  loadQuizzes() {
    homeApi.quizzes()
      .then((data) => {
        const list = (data && (data.list || data)) || []
        if (!list.length) return
        const colors = ['#34B8C5', '#1888BF', '#F6D081']
        const icons = [
          '/assets/home/home-quiz1.png',
          '/assets/home/home-quiz2.png',
          '/assets/home/home-quiz3.png'
        ]
        this.setData({
          quizzes: list.map((item: any, index: number) => ({
            id: item.id,
            title: item.title,
            icon: item.coverUrl || icons[index % icons.length],
            color: colors[index % colors.length]
          }))
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

  onSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  goSpots() {
    wx.navigateTo({ url: '/pages/spots/spots' })
  },

  onFeature(e: any) {
    const title = e.currentTarget.dataset.title
    const url = FEATURE_ROUTES[title]
    if (url) {
      wx.navigateTo({ url })
      return
    }
    toast(title)
  },

  onQuiz(e: any) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: id ? `/pages/quiz/quiz?id=${id}` : '/pages/quiz/quiz'
    })
  },

  openWiki(e: any) {
    const item = e.currentTarget.dataset.item || {}
    const id = item.speciesId || ((item.wikiPath || '').split('/').pop())
    if (!id) {
      toast('暂无对应图鉴')
      return
    }
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${id}` })
  },

  goAchieve() {
    wx.switchTab({ url: '/pages/achieve/achieve' })
  },

  goDiscover() {
    if (!requireLogin()) return
    wx.navigateTo({
      url: `/pages/discover/discover?spotId=${this.data.spotId}`
    })
  },

  onRefreshAdvice() {
    wx.showLoading({ title: '生成建议', mask: true })
    aiApi.tideAdvice(this.data.spotId)
      .then((advice) => {
        this.setData({
          advice: advice || {},
          heroDesc: (advice && advice.headline) || this.data.heroDesc,
          tideTag: (advice && advice.fallback) ? '规则降级' : 'AI 建议'
        })
      })
      .catch((err) => showError(err, '出门建议失败'))
      .finally(() => wx.hideLoading())
  },

  onGuess() {
    if (!requireLogin()) return
    chooseImage()
      .then((filePath) => {
        this.setData({ guessImage: filePath })
        wx.showLoading({ title: '小螃蟹在看', mask: true })
        return uploadImage('speciesGuess', filePath)
      })
      .then((uploadId) => aiApi.speciesGuess({
        uploadId,
        spotId: this.data.spotId,
        tideHeightM: this.data.tideHeightM,
        tideTrend: this.data.tideTrend,
        clientTime: nowISO()
      }))
      .then((guess) => {
        this.lastGuessId = guess && guess.guessId
        this.setData({ showGuess: true, guess: guess || {} })
        enqueueUnlocks((guess && guess.unlockedMedalIds) || [], 'guess')
        flushUnlocks(this)
      })
      .catch((err) => {
        if (err && err.message === 'cancel') return
        showError(err, '识别失败')
      })
      .finally(() => wx.hideLoading())
  },

  closeGuess() {
    this.setData({ showGuess: false })
  },

  noop() {}
})
