import { achieveApi } from '../../services/api'
import { toast } from '../../utils/format'
import { buildMedalDetail } from '../../utils/medals'

Page({
  data: {
    medalId: '',
    medal: null as any,
    loading: true,
    entered: false,
    notFound: false,
    // 后端生成的分享内容（title / imageUrl / path / copyText），失败时回退本地文案
    share: null as any,
    shareLoaded: false
  },

  onLoad(query: any) {
    const id = String((query && query.id) || '')
    const app = getApp()
    const preview = app && app.globalData ? app.globalData.medalPreview : null
    if (app && app.globalData) app.globalData.medalPreview = null
    this.setData({ medalId: id })
    // 列表页已经算好展示数据，先秒出再拉详情校准
    if (preview && String(preview.id) === id) {
      this.setData({ medal: buildMedalDetail(preview, null), loading: false })
      this.playEnter()
    }
    this.loadDetail()
  },

  loadDetail() {
    if (!this.data.medalId) {
      this.setData({ loading: false, notFound: true })
      return
    }
    achieveApi.medal(this.data.medalId)
      .then((detail) => {
        this.setData({ medal: buildMedalDetail(this.data.medal, detail), loading: false })
        this.playEnter()
      })
      .catch(() => {
        if (this.data.medal) {
          this.setData({ loading: false })
          this.playEnter()
        } else {
          this.setData({ loading: false, notFound: true })
        }
      })
  },

  /** 数据就位后再挂 .entered，让"徽章登场"动画有一帧启动差 */
  playEnter() {
    if (this.data.entered) return
    this.loadShare()
    setTimeout(() => this.setData({ entered: true }), 40)
  },

  /**
   * 分享内容统一由后端按 medal_id 生成，提前拉好供 onShareAppMessage 同步取用。
   * 老 5 枚勋章后端 imageUrl 是空串，分享时兜底。未解锁不拉（页面也不给分享）。
   */
  loadShare() {
    const medal: any = this.data.medal || {}
    if (this.data.shareLoaded || !medal.id || medal.locked) return
    this.setData({ shareLoaded: true })
    achieveApi.shareMedal(medal.id)
      .then((data: any) => {
        if (data) this.setData({ share: data })
      })
      .catch(() => {})
  },

  /**
   * 点击徽章圆圈：重播"解锁弹窗"动画，用页面已有的勋章数据直接播放，
   * 传 { ack: false } 让弹窗跳过 ackUnlock，因此不会再向后端发请求。
   */
  replayUnlock() {
    const medal: any = this.data.medal
    if (!medal || medal.locked || !medal.id) return
    const popup: any = this.selectComponent('#unlockPopup')
    if (!popup) return
    popup.show(
      {
        id: medal.id,
        title: medal.displayTitle || medal.title,
        description: medal.description,
        icon: medal.icon,
        source: 'replay'
      },
      { ack: false }
    )
  },

  getShareCopies() {
    const medal: any = this.data.medal || {}
    const title = medal.displayTitle || medal.title || '追潮记'
    return [
      `我在 #追潮记 解锁了「${title}」成就！每一次探索都是荣耀的印记，你也来挑战吧！🌊✨`,
      `今天的海洋探索又有新收获：成功获得「${title}」勋章！一起去发现潮间带的秘密吧。🦀`
    ]
  },

  copyShareText() {
    if (this.data.medal && this.data.medal.locked) return
    const copies = this.getShareCopies()
    const fallback = copies[Math.floor(Math.random() * copies.length)]
    const text = (this.data.share && this.data.share.copyText) || fallback
    wx.setClipboardData({
      data: text,
      success: () => toast('文案已复制，去分享给微信好友吧')
    })
  },

  onShareAppMessage() {
    const medal: any = this.data.medal || {}
    const share: any = this.data.share || {}
    if (medal.locked) {
      return { title: '来追潮记一起探索海洋吧', path: '/pages/achieve/achieve' }
    }
    return {
      title: share.title || `我获得了「${medal.displayTitle || medal.title}」勋章！`,
      path: share.path || '/pages/achieve/achieve',
      // 老 5 枚勋章 imageUrl 为空串，交给微信用默认截图
      imageUrl: share.imageUrl || undefined
    }
  }
})