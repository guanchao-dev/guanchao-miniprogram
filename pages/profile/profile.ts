import { authApi } from '../../services/api'
import { clearSession, getUser, isLoggedIn, requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { flushUnlocks } from '../../utils/unlock'

const DEFAULT_USER = {
  name: '点击登录',
  level: '登录后同步探索进度',
  avatar: '/assets/badges/crab-cloud.png'
}

Page({
  data: {
    loggedIn: false,
    user: DEFAULT_USER,
    stats: [
      { label: '打卡', value: '-' },
      { label: '获赞', value: '-' },
      { label: '收藏', value: '-' },
      { label: '粉丝', value: '-' }
    ],
    records: [
      { title: '我的观潮记录', icon: '/assets/profile/profile-records.png', tone: 'mint' },
      { title: '潮汐提醒', icon: '/assets/profile/profile-remind.png', tone: 'sky' },
      { title: '潮汐成就', icon: '/assets/profile/profile-medal.png', tone: 'yellow' },
      { title: '我的装备', icon: '/assets/profile/profile-gear.png', tone: 'pink' }
    ],
    menus: [
      { title: '登录 / 注册', icon: '/assets/profile/profile-posts.png' },
      { title: '我的预约', icon: '/assets/profile/profile-booking.png' },
      { title: '设置', icon: '/assets/profile/profile-settings.png' },
      { title: '帮助与反馈', icon: '/assets/profile/profile-help.png' },
      { title: '我的社区笔记', icon: '/assets/profile/profile-posts.png' }
    ]
  },

  onShow() {
    this.refreshUser()
    flushUnlocks(this)
  },

  refreshUser() {
    const loggedIn = isLoggedIn()
    const cached = getUser() || {}
    this.setData({
      loggedIn,
      menus: [
        { title: loggedIn ? '退出登录' : '登录 / 注册', icon: '/assets/profile/profile-posts.png' },
        { title: '我的预约', icon: '/assets/profile/profile-booking.png' },
        { title: '设置', icon: '/assets/profile/profile-settings.png' },
        { title: '帮助与反馈', icon: '/assets/profile/profile-help.png' },
        { title: '我的社区笔记', icon: '/assets/profile/profile-posts.png' }
      ]
    })
    if (!loggedIn) {
      this.setData({ user: DEFAULT_USER })
      return
    }
    this.setData({
      user: {
        name: cached.nickname || '观潮探索者',
        level: cached.title ? `Lv.${cached.level || 1} ${cached.title}` : '海洋探索家',
        avatar: cached.avatarUrl || '/assets/badges/crab-cloud.png'
      }
    })
    authApi.me()
      .then((data) => {
        const stats = data.stats || {}
        this.setData({
          user: {
            name: data.nickname || '观潮探索者',
            level: `Lv.${data.level || 1} ${data.title || '海洋探索家'}`,
            avatar: data.avatarUrl || '/assets/badges/crab-cloud.png'
          },
          stats: [
            { label: '打卡', value: String(stats.checkinCount ?? 0) },
            { label: '获赞', value: String(stats.likeCount ?? 0) },
            { label: '收藏', value: String(stats.favoriteCount ?? 0) },
            { label: '粉丝', value: String(stats.followerCount ?? 0) }
          ]
        })
      })
      .catch((err) => showError(err, '用户信息加载失败'))
  },

  goLogin() {
    if (this.data.loggedIn) return
    wx.navigateTo({ url: '/pages/login/login' })
  },

  goAchieve() {
    wx.switchTab({ url: '/pages/achieve/achieve' })
  },

  onStat(e: any) {
    const label = e.currentTarget.dataset.label
    if (label === '打卡') {
      if (!requireLogin()) return
      wx.navigateTo({ url: '/pages/checkin/checkin' })
      return
    }
    if (label === '收藏') {
      if (!requireLogin()) return
      wx.navigateTo({ url: '/pages/community-user/community-user?id=me&tab=favorites' })
    }
  },

  onItem(e: any) {
    const title = e.currentTarget.dataset.title
    if (title === '登录 / 注册') {
      this.goLogin()
      return
    }
    if (title === '退出登录') {
      clearSession()
      toast('已退出')
      this.refreshUser()
      return
    }
    if (title === '潮汐成就') {
      this.goAchieve()
      return
    }
    if (title === '我的观潮记录') {
      if (!requireLogin()) return
      wx.navigateTo({ url: '/pages/cards/cards' })
      return
    }
    if (title === '潮汐提醒') {
      wx.navigateTo({ url: '/pages/calendar/calendar' })
      return
    }
    if (title === '我的装备') {
      wx.navigateTo({ url: '/pages/gear/gear' })
      return
    }
    if (title === '设置') {
      wx.navigateTo({ url: '/pages/settings/settings' })
      return
    }
    if (title === '帮助与反馈') {
      wx.navigateTo({ url: '/pages/help/help' })
      return
    }
    if (title === '我的社区笔记') {
      if (!requireLogin()) return
      wx.navigateTo({ url: '/pages/community-user/community-user?id=me' })
      return
    }
    if (title === '我的预约') {
      toast('预约即将开放')
    }
  }
})
