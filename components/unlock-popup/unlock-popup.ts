import { ackUnlock, flushUnlocks } from '../../utils/unlock'

Component({
  data: {
    visible: false,
    burst: false,
    medal: { title: '', description: '', icon: '', id: '', source: 'pending' },
    // 「图鉴点亮」复用同一个弹窗，只是文案不同
    kicker: '恭喜你成功解锁徽章！',
    // 回放模式：只播动画，不 ack、不清队列、不跳转
    replay: false
  },

  methods: {
    isShowing() {
      return this.data.visible
    },

    /** opts.ack === false 表示纯回放：只播动画，不向后端上报 */
    show(medal: any, opts?: { ack?: boolean }) {
      const isSpecies = !!(medal && medal.source === 'species')
      const ack = !(opts && opts.ack === false)
      this.setData({
        visible: true,
        burst: false,
        replay: !ack,
        kicker: isSpecies ? '图鉴点亮！' : '恭喜你成功解锁徽章！',
        medal: medal || this.data.medal
      })
      try {
        wx.vibrateShort({ type: 'heavy' })
      } catch (e) {
        wx.vibrateShort({})
      }
      setTimeout(() => {
        try { wx.vibrateShort({ type: 'medium' }) } catch (err) {}
      }, 120)
      setTimeout(() => this.setData({ burst: true }), 40)
      if (ack) ackUnlock(medal && medal.id, (medal && medal.source) || 'pending')
    },

    onClose() {
      const replay = this.data.replay
      this.setData({ visible: false, burst: false })
      // 回放模式不动待解锁队列，避免误触发别的解锁弹窗
      if (replay) return
      const pages = getCurrentPages()
      flushUnlocks(pages[pages.length - 1])
    },

    onView() {
      const medal: any = this.data.medal
      const replay = this.data.replay
      this.setData({ visible: false, burst: false })
      // 回放：当前就在勋章详情页，直接关闭，不再跳转
      if (replay) return
      // 图鉴点亮 → 跳到该物种详情；勋章 → 跳勋章详情页
      if (medal && medal.source === 'species') {
        wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${medal.id || ''}` })
        return
      }
      const app = getApp()
      if (app.globalData && medal) app.globalData.medalPreview = medal
      wx.navigateTo({ url: `/pages/medal-detail/medal-detail?id=${(medal && medal.id) || ''}` })
    },

    noop() {}
  }
})
