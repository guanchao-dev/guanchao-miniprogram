import { authApi, contentApi } from '../../services/api'
import { clearSession, isLoggedIn, requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { resetOnboarding } from '../../utils/onboardingStore'

Page({
  data: {
    version: '',
    loggedIn: false
  },

  onShow() {
    this.setData({ loggedIn: isLoggedIn() })
    contentApi.legal()
      .then((legal) => this.setData({ version: (legal && legal.version) || '' }))
      .catch(() => {})
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/legal/legal' })
  },

  goAbout() {
    wx.navigateTo({ url: '/pages/about/about' })
  },

  goFaq() {
    wx.navigateTo({ url: '/pages/faq/faq' })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确认退出当前账号吗？',
      confirmText: '退出',
      success: (res) => {
        if (!res.confirm) return
        clearSession()
        this.setData({ loggedIn: false })
        toast('已退出')
      }
    })
  },

  /** 再次查看新手教程：清完成标记 → 跳首页 → onShow 自动启动 */
  onReplayOnboarding() {
    resetOnboarding()
    wx.switchTab({ url: '/pages/home/home' })
  },

  onDelete() {
    if (!requireLogin()) return
    wx.showModal({
      title: '注销账号',
      content: '将删除本账号相关数据，且不可恢复。确定继续？',
      success: (res) => {
        if (!res.confirm) return
        authApi.deleteAccount()
          .then(() => {
            clearSession()
            this.setData({ loggedIn: false })
            toast('已注销')
            setTimeout(() => wx.switchTab({ url: '/pages/profile/profile' }), 400)
          })
          .catch((err) => showError(err, '注销失败'))
      }
    })
  }
})
