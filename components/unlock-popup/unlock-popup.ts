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
    sparks: buildSparks()
  },

  methods: {
    isShowing() {
      return this.data.visible
    },

    show(medal: any) {
      this.setData({
        visible: true,
        burst: false,
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
