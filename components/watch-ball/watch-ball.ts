import { endWatchNow, getBallMetrics, getBallPos, getWatchBallState, setBallPos, subscribeWatchBall } from '../../utils/watchBall'
import { toast } from '../../utils/format'

/**
 * 观潮计时悬浮球（全局组件）：
 * 在所有页面显示，位置跨页面共享；点一下弹「结束 / 继续观潮」。
 * 计时与观潮状态由 utils/watchBall 单例维护。
 */
Component({
  data: {
    visible: false,
    duration: '00:00',
    ballLeft: 0,
    ballTop: 0,
    snapping: false
  },

  lifetimes: {
    attached() {
      const self = this as any
      const m = getBallMetrics()
      const pos = getBallPos()
      self.winW = m.winW
      self.winH = m.winH
      self.ballSize = m.ballSize
      self.ballMargin = m.ballMargin
      self.pageVisible = true
      self.modalShown = false
      self.dragging = false
      self.startX = 0
      self.startY = 0
      self.touchTime = 0
      self.origLeft = pos.left
      self.origTop = pos.top
      this.setData({ ballLeft: pos.left, ballTop: pos.top })
      self.unsub = subscribeWatchBall((state) => {
        if (!self.pageVisible) return
        self.setData({ visible: state.watching && !self.modalShown, duration: state.duration })
      })
    },

    detached() {
      const self = this as any
      if (self.unsub) {
        self.unsub()
        self.unsub = null
      }
    }
  },

  pageLifetimes: {
    show() {
      const self = this as any
      self.pageVisible = true
      const pos = getBallPos()
      const state = getWatchBallState()
      this.setData({
        ballLeft: pos.left,
        ballTop: pos.top,
        visible: state.watching && !self.modalShown,
        duration: state.duration
      })
    },

    hide() {
      const self = this as any
      self.pageVisible = false
    }
  },

  methods: {
    onTouchStart(e: any) {
      const self = this as any
      const t = e.touches && e.touches[0]
      if (!t) return
      self.dragging = true
      self.startX = t.clientX
      self.startY = t.clientY
      self.touchTime = Date.now()
      self.origLeft = this.data.ballLeft
      self.origTop = this.data.ballTop
      if (this.data.snapping) this.setData({ snapping: false })
    },

    /** 上下随意拖，左右也跟手；位置全局共享，跨页面不重置 */
    onTouchMove(e: any) {
      const self = this as any
      if (!self.dragging) return
      const t = e.touches && e.touches[0]
      if (!t) return
      const maxX = self.winW - self.ballSize - self.ballMargin
      const maxY = self.winH - self.ballSize - self.ballMargin
      const left = Math.min(Math.max(self.origLeft + (t.clientX - self.startX), self.ballMargin), maxX)
      const top = Math.min(Math.max(self.origTop + (t.clientY - self.startY), self.ballMargin), maxY)
      setBallPos(left, top)
      this.setData({ ballLeft: left, ballTop: top })
    },

    /** 松手：几乎没动且快速离开视为点击；否则左右吸边 */
    onTouchEnd(e: any) {
      const self = this as any
      if (!self.dragging) return
      self.dragging = false
      const ct = e.changedTouches && e.changedTouches[0]
      const dx = ct ? ct.clientX - self.startX : 0
      const dy = ct ? ct.clientY - self.startY : 0
      if (Math.abs(dx) + Math.abs(dy) < 8 && Date.now() - self.touchTime < 400) {
        this.openModal()
        return
      }
      const m = getBallMetrics()
      const maxX = m.winW - m.ballSize - m.ballMargin
      const centerX = this.data.ballLeft + m.ballSize / 2
      const left = centerX < m.winW / 2 ? m.ballMargin : maxX
      setBallPos(left, this.data.ballTop)
      this.setData({ ballLeft: left, snapping: true })
    },

    /** 点击悬浮球：球暂时隐藏并弹窗；继续则恢复显示（计时不中断），结束则全局复位 */
    openModal() {
      const self = this as any
      self.modalShown = true
      this.setData({ visible: false })
      wx.showModal({
        title: '观潮进行中',
        content: `已观潮 ${this.data.duration}，要结束这次观潮吗？`,
        confirmText: '结束观潮',
        cancelText: '继续观潮',
        success: (res) => {
          self.modalShown = false
          if (res.confirm) {
            const record = endWatchNow()
            toast(record ? '已记入观潮记录' : '没有进行中的观潮')
          } else {
            this.setData({ visible: true })
          }
        }
      })
    }
  }
})
