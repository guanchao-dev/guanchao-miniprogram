import { authApi } from '../../services/api'
import { getUser, isLoggedIn } from '../../utils/auth'
import { showError } from '../../utils/format'
import { flushUnlocks } from '../../utils/unlock'
import { downloadImage, mediaUrl } from '../../utils/upload'

const DEFAULT_USER = {
  name: '点击登录',
  level: '登录后同步探索进度',
  avatar: 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png'
}

Page({
  data: {
    loggedIn: false,
    user: DEFAULT_USER,
    services: [
      { title: '潮汐表', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-calendar.png', tone: 'sky', url: '/pages/tide/tide' },
      { title: '潮汐日历', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-quiz1.png', tone: 'mint', url: '/pages/calendar/calendar' },
      { title: '海洋图鉴', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-fish.png', tone: 'yellow', url: '/pages/wiki/wiki' },
      { title: '知识科普', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-science.png', tone: 'pink', url: '/pages/knowledge/knowledge' },
      { title: '成就', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-medal.png', tone: 'yellow', tab: '/pages/achieve/achieve' },
      { title: '装备推荐', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-gear.png', tone: 'pink', url: '/pages/gear/gear' },
      { title: '签到', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-booking.png', tone: 'sky', url: '/pages/checkin-form/checkin-form' },
      { title: '常见问题', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-help.png', tone: 'sky', url: '/pages/faq/faq' },
      { title: '关于我们', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-hero.png', tone: 'mint', url: '/pages/about/about' },
      { title: '设置', icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/profile/profile-settings.png', tone: 'yellow', url: '/pages/settings/settings' }
    ]
  },

  onShow() {
    this.refreshUser()
    flushUnlocks(this)
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
        avatar: cachedAvatar || 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png'
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
            avatar: avatarUrl || 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png'
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
  },

  onCompliance(e: any) {
    const type = e.currentTarget.dataset.type
    if (type) wx.navigateTo({ url: `/pages/compliance/compliance?type=${type}` })
  }
})
