import { achieveApi, authApi } from '../../services/api'
import { getUser, isLoggedIn } from '../../utils/auth'
import { flushUnlocks } from '../../utils/unlock'
import { decorateMedal, sortMedals, MEDAL_LIMIT_ON_ACHIEVE } from '../../utils/medals'
import { downloadImage, mediaUrl } from '../../utils/upload'
import { isOnboarding, getOnboardingIndex, markOnboardingCompleted } from '../../utils/onboardingStore'
import { ONBOARDING_STEPS } from '../../utils/onboardingSteps'

Page({
  data: {
    score: 0,
    total: 1320,
    percent: 0,
    unlockedCount: 0,
    medalTotal: 18,
    levelText: 'Lv.1 海洋探索家',
    medals: [],
    medalLoading: true,
    friends: [],
    boardLoading: true,
    showOnboarding: false,
    onbStartIndex: 0,
    onbRect: null as any
  },

  onShow() {
    // 新手教程跨页续接：检测是否轮到 achieve
    if (isOnboarding()) {
      const idx = getOnboardingIndex()
      const step = ONBOARDING_STEPS[idx]
      if (step && step.tab === 'achieve') {
        this.setData({ showOnboarding: true, onbStartIndex: idx })
      } else {
        this.setData({ showOnboarding: false })
      }
    }
    this.loadOverview()
    this.loadMedals()
    this.loadLeaderboard()
    this.loadUserLevel()
    flushUnlocks(this)
  },

  onOnboardingFinish() {
    markOnboardingCompleted()
    this.setData({ showOnboarding: false, onbRect: null })
  },

  onOnboardingLocate(e: any) {
    const index = Number((e && e.detail && e.detail.index) || 0)
    const step = ONBOARDING_STEPS[index]
    if (!step) return
    // 步骤不属于 achieve → 隐藏并跳转
    if (step.tab && step.tab !== 'achieve') {
      this.setData({ showOnboarding: false })
      const url = step.tab === 'home' ? '/pages/home/home' : '/pages/profile/profile'
      wx.switchTab({ url })
      return
    }
    // achieve 步骤无锚点，居中展示
    this.setData({ onbRect: { index, rect: null } })
  },

  loadOverview() {
    achieveApi.overview()
      .then((data) => {
        this.setData({
          score: data.score || 0,
          total: data.total || 1320,
          percent: data.percent || 0,
          unlockedCount: data.unlockedCount || 0,
          medalTotal: data.medalTotal || 18
        })
      })
      .catch(() => {})
  },

  /**
   * 等级文案（Lv.x 称号）来自后端 /me。
   * 先用本地缓存秒出，再用接口结果覆盖；未登录时保持默认 Lv.1。
   */
  loadUserLevel() {
    const paint = (level?: number, title?: string) => {
      this.setData({ levelText: `Lv.${level || 1} ${title || '海洋探索家'}` })
    }
    const cached = getUser() || {}
    paint(cached.level, cached.title)
    if (!isLoggedIn()) return
    authApi.me()
      .then((data) => paint(data && data.level, data && data.title))
      .catch(() => {})
  },

  goSpotCollection() {
    wx.navigateTo({ url: '/pages/spot-collection/spot-collection' })
  },

  /** 成就页只陈列前 8 枚（已解锁优先），完整列表在勋章墙 */
  loadMedals() {
    this.setData({ medalLoading: true })
    achieveApi.medals()
      .then((data) => {
        const list = (data && (data.list || data)) || []
        const shown = sortMedals(list).slice(0, MEDAL_LIMIT_ON_ACHIEVE)
        this.setData({ medals: shown.map(decorateMedal) })
      })
      .catch(() => this.setData({ medals: [] }))
      .finally(() => this.setData({ medalLoading: false }))
  },

  goMedalWall() {
    wx.navigateTo({ url: '/pages/medal-wall/medal-wall' })
  },

  goMedalDetail(e: any) {
    const medal = this.data.medals[e.currentTarget.dataset.index]
    if (!medal || !medal.id) return
    // 用 globalData 传完整展示数据，避免把 CDN 图片地址塞进 url 触发编码问题
    const app = getApp()
    if (app.globalData) app.globalData.medalPreview = medal
    wx.navigateTo({ url: `/pages/medal-detail/medal-detail?id=${medal.id}` })
  },

  /** 成就页只展示前 3 名，完整榜单在排行榜页 */
  loadLeaderboard() {
    const paint = (list: any[]) => {
      this.setData({
        friends: list.slice(0, 3).map((item: any, i: number) => ({
          key: `${item.userId || i}_${i}`,
          rank: item.rank || i + 1,
          name: item.nickname || item.name,
          level: `Lv.${item.level || 1}`,
          score: item.score || 0,
          avatar: item.avatar || 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png',
          me: !!item.me
        }))
      })
      list.slice(0, 3).forEach((item: any, i: number) => {
        const url = item.avatarUrl
        if (url && url.indexOf('/users/') === 0) {
          downloadImage(mediaUrl(url)).then((src) => {
            if (src) this.setData({ [`friends[${i}].avatar`]: src })
          })
        }
      })
    }
    this.setData({ boardLoading: true })
    achieveApi.leaderboard({ scope: 'all', page: 1, pageSize: 3 })
      .then((data) => {
        const list = (data && (data.list || data)) || []
        paint(list)
      })
      .catch(() => paint([]))
      .finally(() => this.setData({ boardLoading: false }))
  },

  goLeaderboard() {
    wx.navigateTo({ url: '/pages/leaderboard/leaderboard' })
  }
})