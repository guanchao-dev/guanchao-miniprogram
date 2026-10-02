import { ackUnlock, flushUnlocks } from '../../utils/unlock'

const COLORS = ['#F6D081', '#34B8C5', '#FFFFFF', '#A7D9C7', '#1888BF']

function buildSparks() {
  const list: any[] = []
  for (let i = 0; i < 16; i++) {
    list.push({
      i,
      deg: i * 22.5,
      delay: (i % 5) * 40,
      dist: 140 + (i % 4) * 28,
      size: 10 + (i % 3) * 4,
      color: COLORS[i % COLORS.length]
    })
  }
  return list
}

Component({
  data: {
    visible: false,
    burst: false,
    medal: { title: '', description: '', icon: '', id: '', source: 'pending' },
    // 「图鉴点亮」复用同一个弹窗，只是文案不同
    kicker: '恭喜你成功解锁徽章！',
    sparks: buildSparks()
  },

  methods: {
    isShowing() {
      return this.data.visible
    },

    show(medal: any) {
      const isSpecies = !!(medal && medal.source === 'species')
      this.setData({
        visible: true,
        burst: false,
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
      ackUnlock(medal && medal.id, (medal && medal.source) || 'pending')
    },

    onClose() {
      this.setData({ visible: false, burst: false })
      const pages = getCurrentPages()
      flushUnlocks(pages[pages.length - 1])
    },

    onView() {
      const medal: any = this.data.medal
      this.setData({ visible: false, burst: false })
      // 图鉴点亮 → 跳到该物种详情；勋章 → 跳成就页
      if (medal && medal.source === 'species') {
        wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${medal.id || ''}` })
        return
      }
      const app = getApp()
      if (app.globalData) app.globalData.openMedalId = medal && medal.id
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1]
      if (cur && cur.route === 'pages/achieve/achieve') {
        if (cur.openUnlocked) cur.openUnlocked(medal)
        return
      }
      wx.switchTab({ url: '/pages/achieve/achieve' })
    },

    noop() {}
  }
})
