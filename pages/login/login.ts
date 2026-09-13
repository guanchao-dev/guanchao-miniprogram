import { authApi } from '../../services/api'
import { saveSession, getUser } from '../../utils/auth'
import { getClientId } from '../../utils/client'
import { showError, toast } from '../../utils/format'

const DEFAULT_AVATAR = 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png'

Page({
  data: {
    loading: false,
    defaultAvatar: DEFAULT_AVATAR,
    avatarUrl: '',       // chooseAvatar 拿到的临时文件路径
    avatarPreview: '',   // 界面上显示的（本地临时文件）
    nickname: ''
  },

  /** 选择微信头像：button open-type="chooseAvatar" 回调，选完即为本地临时文件 */
  onChooseAvatar(e: any) {
    const url = (e.detail && e.detail.avatarUrl) || ''
    if (!url) return
    this.setData({ avatarUrl: url, avatarPreview: url })
  },

  /** 昵称输入：type="nickname" 时微信会给出「使用微信昵称」的建议，点一下即填 */
  onNickname(e: any) {
    this.setData({ nickname: (e.detail.value || '').trim() })
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
        authApi.wechatLogin(res.code, getClientId())
          .then((data) => {
            saveSession(data || {})
            return this.syncProfile()
          })
          .then(() => {
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
  },

  /** 登录成功后把头像/昵称同步到服务端（失败不阻断登录） */
  syncProfile(): Promise<void> {
    const tasks: Array<Promise<any>> = []
    if (this.data.avatarUrl) {
      tasks.push(
        authApi.updateAvatar(this.data.avatarUrl)
          .then((res: any) => {
            const cached = getUser() || {}
            if (res && res.avatarUrl) cached.avatarUrl = res.avatarUrl
            saveSession({ user: cached })
          })
          .catch(() => {})
      )
    }
    if (this.data.nickname) {
      tasks.push(
        authApi.updateNickname(this.data.nickname)
          .then(() => {
            const cached = getUser() || {}
            cached.nickname = this.data.nickname
            saveSession({ user: cached })
          })
          .catch(() => {})
      )
    }
    return Promise.all(tasks).then(() => undefined)
  }
})
