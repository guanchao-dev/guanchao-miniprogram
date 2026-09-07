import { authApi } from '../../services/api'
import { saveSession } from '../../utils/auth'
import { showError, toast } from '../../utils/format'

Page({
  data: {
    loading: false
  },

  onWechatLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })
    wx.login({
      success: (res: any) => {
        if (!res.code) {
          this.setData({ loading: false })
          toast('未拿到微信 code')
          return
        }
        authApi.wechatLogin(res.code)
          .then((data) => {
            saveSession(data || {})
            toast('登录成功')
            setTimeout(() => wx.navigateBack({ delta: 1 }), 400)
          })
          .catch((err) => showError(err, '微信登录失败'))
          .finally(() => this.setData({ loading: false }))
      },
      fail: () => {
        this.setData({ loading: false })
        toast('wx.login 失败')
      }
    })
  }
})
