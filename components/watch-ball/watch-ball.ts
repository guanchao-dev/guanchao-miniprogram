import { endWatchNow, getBallMetrics, getBallPos, getWatchBallState, setBallPos, subscribeWatchBall } from '../../utils/watchBall'
import { toast } from '../../utils/format'

/**
 * 赶海计时悬浮球（全局组件）：
 * 在所有页面显示，位置跨页面共享；点一下在球旁展开操作菜单
 * （生物识别 / 生态净滩 / 结束赶海），计时不中断。
 * 计时与赶海状态由 utils/watchBall 单例维护。
 */
Component({
  data: {
    visible: false,
    duration: '00:00',
    ballLeft: 0,
    ballTop: 0,
    snapping: false,
    // 操作菜单：位置由球的坐标算出来，避免菜单跑到屏幕外
    menuVisible: false,
    menuLeft: 0,
    menuTop: 0
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
      self.detecting = false
      self.dragging = false
      self.startX = 0
      self.startY = 0
      self.touchTime = 0
      self.origLeft = pos.left
      self.origTop = pos.top
      this.setData({ ballLeft: pos.left, ballTop: pos.top })
      self.unsub = subscribeWatchBall((state) => {
        if (!self.pageVisible) return
        self.setData({
          visible: state.watching && !self.modalShown && !self.detecting,
          duration: state.duration
        })
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
        visible: state.watching && !self.modalShown && !self.detecting,
        duration: state.duration
      })
    },

    hide() {
      const self = this as any
      self.pageVisible = false
      // 离开页面时收起菜单，回来不残留
      if (this.data.menuVisible) this.setData({ menuVisible: false })
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
        this.openMenu()
        return
      }
      const m = getBallMetrics()
      const maxX = m.winW - m.ballSize - m.ballMargin
      const centerX = this.data.ballLeft + m.ballSize / 2
      const left = centerX < m.winW / 2 ? m.ballMargin : maxX
      setBallPos(left, this.data.ballTop)
      this.setData({ ballLeft: left, snapping: true })
    },

    /** 点击悬浮球：在球旁边展开操作菜单，球保持可见、计时不中断 */
    openMenu() {
      const m = getBallMetrics()
      const r = m.winW / 750
      // 与 wxss 里 .ball-menu 的 236rpx 宽 / 276rpx 高保持一致
      const menuW = 236 * r
      const menuH = 276 * r
      const gap = 16 * r
      const margin = 12 * r
      // 球在左半边就向右展开，否则向左；再统一收进可视区
      const openRight = this.data.ballLeft + m.ballSize + gap + menuW <= m.winW - margin
      let left = openRight ? this.data.ballLeft + m.ballSize + gap : this.data.ballLeft - menuW - gap
      left = Math.max(margin, Math.min(left, m.winW - menuW - margin))
      const top = Math.max(margin, Math.min(
        this.data.ballTop + m.ballSize / 2 - menuH / 2,
        m.winH - menuH - margin
      ))
      this.setData({ menuVisible: true, menuLeft: left, menuTop: top })
    },

    closeMenu() {
      if (this.data.menuVisible) this.setData({ menuVisible: false })
    },

    noop() {},

    onMenuGuess() {
      this.openDetect('guess')
    },

    onMenuTrash() {
      this.openDetect('trash')
    },

    /** 识别流程和结果弹窗都在 ai-detect 组件里，当前页面就地完成，不跳首页 */
    openDetect(mode: 'guess' | 'trash') {
      this.closeMenu()
      const comp: any = this.selectComponent('#aiDetect')
      if (comp) comp.detect(mode)
    },

    /** 识别结果弹出来时先收起球，免得被遮罩压成一块暗色 */
    onDetectShow() {
      const self = this as any
      self.detecting = true
      this.setData({ visible: false })
    },

    onDetectClose() {
      const self = this as any
      self.detecting = false
      this.setData({ visible: getWatchBallState().watching })
    },

    /** 菜单里结束赶海：保留二次确认，避免误触把这次记录结掉 */
    onMenuEnd() {
      this.closeMenu()
      const self = this as any
      self.modalShown = true
      this.setData({ visible: false })
      wx.showModal({
        title: '赶海进行中',
        content: `已赶海 ${this.data.duration}，要结束这次赶海吗？`,
        confirmText: '结束赶海',
        cancelText: '继续赶海',
        success: (res) => {
          self.modalShown = false
          if (res.confirm) {
            const record = endWatchNow()
            toast(record ? '已记入赶海记录' : '没有进行中的赶海')
          } else {
            this.setData({ visible: true })
          }
        }
      })
    }
  }
})
