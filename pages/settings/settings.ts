import { authApi, contentApi } from '../../services/api'
import { clearSession, requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'

Page({
  data: {
    version: ''
  },

  onShow() {
    contentApi.legal()
      .then((legal) => this.setData({ version: (legal && legal.version) || '' }))
      .catch(() => {})
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/legal/legal' })
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
            toast('已注销')
            setTimeout(() => wx.switchTab({ url: '/pages/profile/profile' }), 400)
          })
          .catch((err) => showError(err, '注销失败'))
      }
    })
  }
})
