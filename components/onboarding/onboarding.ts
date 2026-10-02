import { ONBOARDING_STEPS } from '../../utils/onboardingSteps'
import { setOnboardingIndex, clearOnboardingIndex } from '../../utils/onboardingStore'

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number } | null

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    /** 页面回传的锚点测量结果 { index, rect } */
    targetRect: {
      type: Object,
      value: null
    },
    /** 起始步骤 index（跨页续接时由目标页传入） */
    startIndex: {
      type: Number,
      value: 0
    }
  },

  data: {
    current: 0,
    total: ONBOARDING_STEPS.length,
    step: ONBOARDING_STEPS[0],
    /** below / above / center / moving */
    placement: 'center',
    holeStyle: '',
    bubbleStyle: '',
    tailStyle: '',
    /** 全屏蒙层常驻，moving 时也保持 */
    showMask: false
  },

  observers: {
    'visible'(val: boolean) {
      if (val) {
        const start = this.data.startIndex || 0
        this.setData({
          current: start,
          step: ONBOARDING_STEPS[start],
          placement: 'center',
          showMask: true,
          holeStyle: 'left:0;top:0;width:100vw;height:100vh;'
        })
        wx.nextTick(() => {
          this.triggerEvent('locate', { index: start })
        })
      } else {
        this.setData({ showMask: false })
      }
    },

    'targetRect'(val: any) {
      if (val && this.data.visible && val.index === this.data.current) {
        this.layout(val.rect as Rect)
      }
    }
  },

  methods: {
    layout(rect: Rect) {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const winH = info.windowHeight
      const winW = info.windowWidth

      if (!rect) {
        this.setData({
          placement: 'center',
          holeStyle: 'left:0;top:0;width:100vw;height:100vh;',
          bubbleStyle: '',
          tailStyle: ''
        })
        return
      }

      const pad = 6
      const left = rect.left - pad
      const top = rect.top - pad
      const width = rect.width + pad * 2
      const height = rect.height + pad * 2
      const holeStyle = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;`

      const centerX = rect.left + rect.width / 2
      const tailLeft = Math.max(30, Math.min(winW - 60, centerX - 11))
      const tailStyle = `left:${tailLeft}px;`

      const below = rect.top < winH * 0.5
      const bubbleStyle = below
        ? `top:${top + height + 14}px;`
        : `bottom:${winH - top + 14}px;`

      this.setData({ placement: below ? 'below' : 'above', holeStyle, bubbleStyle, tailStyle })
    },

    onNext() {
      const next = this.data.current + 1
      if (next >= ONBOARDING_STEPS.length) {
        this.finish()
        return
      }
      // 存 index 供目标页续接；过渡中保持蒙层和上一个 hole 位置
      setOnboardingIndex(next)
      this.setData({ current: next, step: ONBOARDING_STEPS[next], placement: 'moving' })
      this.triggerEvent('locate', { index: next })
    },

    onSkip() {
      this.finish()
    },

    finish() {
      clearOnboardingIndex()
      this.triggerEvent('finish')
    },

    /** 点蒙层空白：不做任何事，强制用户点跳过或下一步 */
    noop() {
      /* 拦截冒泡和滚动穿透 */
    }
  }
})
