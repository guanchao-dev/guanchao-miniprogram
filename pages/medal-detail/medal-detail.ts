import { achieveApi } from '../../services/api'
import { toast } from '../../utils/format'
import { buildMedalDetail } from '../../utils/medals'

Page({
  data: {
    medalId: '',
    medal: null as any,
    loading: true,
    entered: false,
    notFound: false
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
    setTimeout(() => this.setData({ entered: true }), 40)
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
    const copies = this.getShareCopies()
    const text = copies[Math.floor(Math.random() * copies.length)]
    wx.setClipboardData({
      data: text,
      success: () => toast('文案已复制，去分享给好友吧')
    })
  },

  onShareAppMessage() {
    const medal: any = this.data.medal || {}
    return {
      title: medal.locked ? '来追潮记一起探索海洋吧' : `我获得了「${medal.displayTitle || medal.title}」勋章！`,
      path: '/pages/achieve/achieve'
    }
  }
})