import { authApi, contentApi } from '../../services/api'
import { clearSession, isLoggedIn, requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'

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

  onConsent() {
    if (!requireLogin()) return
    contentApi.guardianConsent(true, this.data.version || '2026-08-01')
      .then(() => toast('已记录监护人同意'))
      .catch((err) => showError(err, '提交失败'))
  },

  onWithdrawConsent() {
    if (!requireLogin()) return
    wx.showModal({
      title: '撤回同意',
      content: '撤回后部分功能将不可用，公开课程仍可查看。',
      success: (res) => {
        if (!res.confirm) return
        contentApi.withdrawConsent()
          .then(() => toast('已撤回同意'))
          .catch((err) => showError(err, '撤回失败'))
      }
    })
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
