import { authApi } from '../../services/api'
import { getUser, isLoggedIn, saveSession } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { downloadImage, mediaUrl } from '../../utils/upload'

const DEFAULT_AVATAR = 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png'

Page({
  data: {
    loggedIn: false,
    saving: false,
    avatarPreview: DEFAULT_AVATAR,
    avatarTemp: '',   // chooseAvatar 拿到的本地临时文件，非空表示本次换过头像
    nickname: '',
    levelText: ''
  },

  onShow() {
    const loggedIn = isLoggedIn()
    this.setData({ loggedIn })
    if (!loggedIn) return
    const cached = getUser()
    if (cached) this.applyUser(cached)
    authApi.me()
      .then((data) => this.applyUser(data || {}))
      .catch(() => {})
  },

  applyUser(u: any) {
    if (!u) return
    const patch: any = {
      nickname: u.nickname || this.data.nickname || '',
      levelText: u.level ? `Lv.${u.level} ${u.title || '海洋探索家'}` : '海洋探索家'
    }
    this.setData(patch)
    if (!this.data.avatarTemp && u.avatarUrl) {
      const url = mediaUrl(u.avatarUrl)
      if (url) {
        downloadImage(url).then((src) => {
          if (src) this.setData({ avatarPreview: src })
        })
      }
    }
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  /** 微信授权头像：button open-type="chooseAvatar" 回调，选完先本地预览 */
  onChooseAvatar(e: any) {
    const url = (e.detail && e.detail.avatarUrl) || ''
    if (!url) return
    this.setData({ avatarTemp: url, avatarPreview: url })
  },

  onNickname(e: any) {
    this.setData({ nickname: e.detail.value || '' })
  },

  onSave() {
    if (this.data.saving) return
    const cached = getUser() || {}
    const nickname = (this.data.nickname || '').trim()
    const nicknameChanged = !!nickname && nickname !== (cached.nickname || '')
    if (!this.data.avatarTemp && !nicknameChanged) {
      toast('没有需要保存的修改')
      return
    }
    this.setData({ saving: true })
    const tasks: Array<Promise<any>> = []
    if (this.data.avatarTemp) {
      tasks.push(
        authApi.updateAvatar(this.data.avatarTemp).then((res: any) => {
          const user = getUser() || {}
          if (res && res.avatarUrl) user.avatarUrl = res.avatarUrl
          saveSession({ user })
        })
      )
    }
    if (nicknameChanged) {
      tasks.push(
        authApi.updateNickname(nickname).then(() => {
          const user = getUser() || {}
          user.nickname = nickname
          saveSession({ user })
        })
      )
    }
    Promise.all(tasks)
      .then(() => {
        toast('资料已更新')
        setTimeout(() => wx.navigateBack({ delta: 1 }), 500)
      })
      .catch((err) => showError(err, '保存失败'))
      .finally(() => this.setData({ saving: false }))
  }
})
