import { authApi, contentApi } from '../../services/api'
import { getUser, isLoggedIn } from '../../utils/auth'
import { showError } from '../../utils/format'
import { flushUnlocks } from '../../utils/unlock'
import { downloadImage, mediaUrl } from '../../utils/upload'
import { isOnboarding, getOnboardingIndex, markOnboardingCompleted } from '../../utils/onboardingStore'
import { ONBOARDING_STEPS } from '../../utils/onboardingSteps'

const DEFAULT_AVATAR = 'https://www.blueakaiwu.cn/api/v1/static/assets/to-upload/mascot-avatar.png'

const DEFAULT_USER = {
  name: '点击登录',
  level: '登录后同步探索进度',
  avatar: DEFAULT_AVATAR
}

Page({
  data: {
    loggedIn: false,
    user: DEFAULT_USER,
    // 未读消息数（铃铛上的红点）
    unread: 0,
    services: [
      { title: '潮汐表', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-calendar.png', tone: 'sky', url: '/pages/tide/tide' },
      { title: '潮汐日历', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-quiz1.png', tone: 'mint', url: '/pages/calendar/calendar' },
      { title: '海洋图鉴', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-fish.png', tone: 'yellow', url: '/pages/wiki/wiki' },
      { title: '知识科普', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-science.png', tone: 'pink', url: '/pages/knowledge/knowledge' },
      { title: '宝藏点位', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-nearby.png', tone: 'mint', url: '/pages/my-spots/my-spots' },
      { title: '成就', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-medal.png', tone: 'yellow', tab: '/pages/achieve/achieve' },
      { title: '装备推荐', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-gear.png', tone: 'pink', url: '/pages/gear/gear' },
      { title: '签到', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-booking.png', tone: 'sky', url: '/pages/checkin-form/checkin-form' },
      { title: '常见问题', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-help.png', tone: 'sky', url: '/pages/faq/faq' },
      { title: '关于我们', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-hero.png', tone: 'mint', url: '/pages/about/about' },
      { title: '设置', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-settings.png', tone: 'yellow', url: '/pages/settings/settings' }
    ],
    showOnboarding: false,
    onbStartIndex: 0,
    onbRect: null as any
  },

  onShow() {
    // 新手教程跨页续接：检测是否轮到 profile
    if (isOnboarding()) {
      const idx = getOnboardingIndex()
      const step = ONBOARDING_STEPS[idx]
      if (step && step.tab === 'profile') {
        this.setData({ showOnboarding: true, onbStartIndex: idx })
      } else {
        this.setData({ showOnboarding: false })
      }
    }
    this.refreshUser()
    flushUnlocks(this)
    this.loadUnread()
  },

  /** 铃铛上的未读数。未登录就不显示红点 */
  loadUnread() {
    if (!isLoggedIn()) {
      this.setData({ unread: 0 })
      return
    }
    contentApi
      .notificationsUnread()
      .then((res: any) => this.setData({ unread: Number((res && res.count) || 0) }))
      .catch(() => {})
  },

  goNotifications() {
    wx.navigateTo({ url: '/pages/notifications/notifications' })
  },

  onOnboardingFinish() {
    markOnboardingCompleted()
    this.setData({ showOnboarding: false, onbRect: null })
  },

  onOnboardingLocate(e: any) {
    const index = Number((e && e.detail && e.detail.index) || 0)
    const step = ONBOARDING_STEPS[index]
    if (!step) return
    if (step.tab && step.tab !== 'profile') {
      this.setData({ showOnboarding: false })
      const url = step.tab === 'home' ? '/pages/home/home' : '/pages/achieve/achieve'
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
          if (retries++ < 5) { setTimeout(doMeasure, 150); return }
          this.setData({ onbRect: { index, rect: null } })
          return
        }
        if (rect.top < 40 || rect.top > winH * 0.55) {
          // 已滚到底（scrollTop 不再变化）：接受当前位置，避免空转
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

  refreshUser() {
    const loggedIn = isLoggedIn()
    const cached = getUser() || {}
    this.setData({ loggedIn })
    if (!loggedIn) {
      this.setData({ user: DEFAULT_USER })
      return
    }
    const cachedAvatar = mediaUrl(cached.avatarUrl)
    this.setData({
      user: {
        name: cached.nickname || '寻潮探索者',
        level: cached.title ? `Lv.${cached.level || 1} ${cached.title}` : '海洋探索家',
        avatar: cachedAvatar || DEFAULT_AVATAR
      }
    })
    if (cachedAvatar) this.applyAvatar(cachedAvatar)
    authApi.me()
      .then((data) => {
        const avatarUrl = mediaUrl(data.avatarUrl)
        this.setData({
          user: {
            name: data.nickname || '寻潮探索者',
            level: `Lv.${data.level || 1} ${data.title || '海洋探索家'}`,
            avatar: avatarUrl || DEFAULT_AVATAR
          }
        })
        if (avatarUrl) this.applyAvatar(avatarUrl)
      })
      .catch((err) => showError(err, '用户信息加载失败'))
  },

  applyAvatar(url: string) {
    downloadImage(url).then((src) => {
      if (src) this.setData({ 'user.avatar': src })
    })
  },

  goLogin() {
    if (this.data.loggedIn) return
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goEditProfile() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
  },

  goRecords() {
    wx.navigateTo({ url: '/pages/cards/cards' })
  },

  onService(e: any) {
    const { url, tab } = e.currentTarget.dataset
    if (tab) {
      wx.switchTab({ url: tab })
    } else if (url) {
      wx.navigateTo({ url })
    }
  }
})
