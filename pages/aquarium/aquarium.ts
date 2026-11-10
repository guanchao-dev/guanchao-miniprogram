import {
  AquariumResident,
  ResidentKind,
  clearResidents,
  ensureDemoResident
} from '../../utils/aquariumStore'
import { requireLogin } from '../../utils/auth'
import { toast } from '../../utils/format'

type Runtime = {
  id: string
  name: string
  kind: ResidentKind
  src: string
  aspect: number
  size: number
  w: number
  h: number
  lane: number
  speed: number
  phase: number
  x: number
  y: number
  vx: number
  vy: number
  entering: boolean
  initialized: boolean
  baseFlip: boolean
  reactUntil: number
  nextWake: number
  say: string
  sayUntil: number
  imgTransform: string
  createdAt: number
}

type Wake = {
  id: string
  left: number
  top: number
  size: number
  dir: 'left' | 'right'
  until: number
}

const SAY_WORDS = ['咕噜～', '你好呀', '吐个泡泡', '今天也要开心', '别抓我！']

Page({
  data: {
    residents: [] as any[],
    wakes: [] as any[],
    count: 0,
    empty: false,
    loading: true
  },

  // ===== 页面实例字段（不参与渲染）=====
  runtime: [] as Runtime[],
  timer: null as any,
  tankW: 0,
  tankH: 0,
  lastTick: 0,
  wakeList: [] as Wake[],
  wakeSeq: 0,

  onShow() {
    const list = ensureDemoResident()
    this.syncRuntime(list)
    this.setData({
      loading: false,
      count: list.length,
      empty: list.length === 0
    })
    if (this.tankW > 4 && list.length) {
      this.renderStatic()
      this.startLoop()
    }
    if (!list.length) this.stopLoop()
  },

  onReady() {
    this.measureTank()
  },

  onHide() {
    this.stopLoop()
  },

  onUnload() {
    this.stopLoop()
  },

  measureTank() {
    const query = this.createSelectorQuery()
    query.select('#residentsLayer').boundingClientRect((rect: any) => {
      if (rect && rect.width && rect.height) {
        this.tankW = rect.width
        this.tankH = rect.height
      } else {
        // 查询失败时用屏幕宽度估算，避免整个缸空白
        const sys = wx.getSystemInfoSync()
        const w = Number(sys.windowWidth) || 375
        this.tankW = Math.round(w * 0.909)
        this.tankH = Math.round(w * 1.024)
      }
      this.runtime.forEach((r: Runtime) => {
        if (!r.initialized) this.layout(r)
      })
      if (this.runtime.length) {
        this.renderStatic()
        this.startLoop()
      }
    }).exec()
  },

  syncRuntime(list: AquariumResident[]) {
    const prev: Record<string, Runtime> = {}
    this.runtime.forEach((r: Runtime) => { prev[r.id] = r })

    const next: Runtime[] = []
    list.forEach((item) => {
      const old = prev[item.id]
      if (old) {
        old.name = item.name
        old.kind = item.kind
        old.src = item.src
        old.aspect = item.aspect
        old.baseFlip = item.baseFlip
        next.push(old)
      } else {
        const r = this.createRuntime(item)
        if (this.tankW > 4) this.layout(r)
        next.push(r)
      }
    })
    this.runtime = next
  },

  createRuntime(item: AquariumResident): Runtime {
    const kind: ResidentKind = item.kind
    return {
      id: item.id,
      name: item.name,
      kind,
      src: item.src,
      aspect: item.aspect || 1,
      size: 0,
      w: 0,
      h: 0,
      lane: 0,
      speed: this.baseSpeed(kind),
      phase: Math.random() * Math.PI * 2,
      x: 0,
      y: 0,
      vx: Math.random() < 0.5 ? -1 : 1,
      vy: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 10),
      entering: false,
      initialized: false,
      baseFlip: item.baseFlip,
      reactUntil: 0,
      nextWake: 0,
      say: '',
      sayUntil: 0,
      imgTransform: '',
      createdAt: item.createdAt
    }
  },

  baseSpeed(kind: ResidentKind): number {
    if (kind === 'crab') return 14 + Math.random() * 8
    if (kind === 'snail') return 4 + Math.random() * 3
    if (kind === 'fish') return 34 + Math.random() * 34
    return 10 + Math.random() * 8
  },

  layout(r: Runtime) {
    const W = this.tankW
    const H = this.tankH
    if (W < 5 || H < 5) return

    const scale = Math.max(0.8, Math.min(1.12, W / 820))
    const baseSize = r.kind === 'fish' ? 136 : r.kind === 'crab' ? 124 : r.kind === 'snail' ? 100 : 116
    r.size = Math.round(baseSize * scale)
    r.w = r.size
    r.h = Math.max(20, Math.round(r.size * (r.aspect || 1)))

    if (r.kind === 'crab') r.lane = 0.67 + Math.random() * 0.05
    else if (r.kind === 'snail') r.lane = 0.72 + Math.random() * 0.04
    else if (r.kind === 'fish') r.lane = 0.18 + Math.random() * 0.34
    else r.lane = 0.2 + Math.random() * 0.45

    r.x = 12 + Math.random() * Math.max(12, W - r.w - 24)
    if (r.kind === 'jelly') {
      r.y = 14 + Math.random() * Math.max(12, H * 0.52 - r.h)
    } else {
      r.y = Math.max(14, Math.min(H - r.h - 22, H * r.lane))
    }

    // 刚放进去的鱼从缸边游进来，水母从缸底升上来
    if (Date.now() - r.createdAt < 15000) {
      if (r.kind === 'fish') {
        const fromLeft = Math.random() < 0.5
        r.x = fromLeft ? -r.w - 14 : W + 14
        r.vx = fromLeft ? 1 : -1
        r.entering = true
      } else if (r.kind === 'jelly') {
        r.y = H + 16
        r.vy = -Math.abs(r.vy)
        r.entering = true
      }
    }

    r.initialized = true
  },

  /**
   * 只在住客增删/重新测量时下发整份数组（含图片 src）。
   * 循环里只 patch 位置和姿态，避免每 40ms 重设 src 导致图片反复加载、闪烁。
   */
  renderStatic() {
    const list = this.runtime.map((r: Runtime) => ({
      id: r.id,
      name: r.name,
      src: r.src,
      size: r.size,
      transform: `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`,
      imgTransform: r.imgTransform || 'scaleX(1)',
      say: r.say || ''
    }))
    this.setData({ residents: list })
  },

  startLoop() {
    this.stopLoop()
    if (this.tankW < 5 || !this.runtime.length) return
    this.lastTick = Date.now()
    this.timer = setInterval(() => this.tick(), 40)
  },

  stopLoop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  tick() {
    if (!this.runtime.length) {
      this.stopLoop()
      return
    }
    const now = Date.now()
    const dt = Math.min(0.06, (now - this.lastTick) / 1000)
    this.lastTick = now
    const W = this.tankW
    const H = this.tankH
    if (W < 5 || H < 5) return

    const speedScale = Math.max(0.7, Math.min(1.5, W / 820))
    let wakesChanged = false

    this.runtime.forEach((r: Runtime) => {
      if (!r.initialized) return
      const reacting = now < r.reactUntil

      if (r.kind === 'jelly') {
        r.y += r.vy * speedScale * (reacting ? 2.2 : 1) * dt
        r.x += Math.sin(now * 0.00055 + r.phase) * 7 * dt
        if (r.entering) {
          if (r.y < H - r.h - 12) r.entering = false
        } else {
          if (r.y < 10) { r.y = 10; r.vy = Math.abs(r.vy) }
          if (r.y > H - r.h - 10) { r.y = H - r.h - 10; r.vy = -Math.abs(r.vy) }
        }
        if (r.x < 8) r.x = 8
        if (r.x > W - r.w - 8) r.x = W - r.w - 8
      } else if (r.kind === 'crab' || r.kind === 'snail') {
        r.x += r.vx * r.speed * speedScale * (reacting ? 3 : 1) * dt
        if (r.x < 10) { r.x = 10; r.vx = Math.abs(r.vx) }
        if (r.x > W - r.w - 10) { r.x = W - r.w - 10; r.vx = -Math.abs(r.vx) }
        const bob = r.kind === 'crab' ? 2.5 : 0.8
        r.y = Math.max(10, Math.min(H - r.h - 22, H * r.lane)) + Math.sin(now * 0.002 + r.phase) * bob
      } else {
        // 鱼：速度有快有慢，沿一条轻微起伏的水路游
        const cruise = 0.72 + 0.38 * (0.5 + 0.5 * Math.sin(now * 0.0005 + r.phase * 2))
        const entry = r.entering ? 2.2 : 1
        r.x += r.vx * r.speed * speedScale * (reacting ? 3.4 : 1) * cruise * entry * dt

        if (r.entering) {
          if ((r.vx > 0 && r.x > 10) || (r.vx < 0 && r.x < W - r.w - 10)) {
            r.entering = false
          }
        } else {
          if (r.x < 10) { r.x = 10; r.vx = Math.abs(r.vx) }
          if (r.x > W - r.w - 10) { r.x = W - r.w - 10; r.vx = -Math.abs(r.vx) }
        }

        const base = Math.max(26, Math.min(H - r.h - 10, H * r.lane))
        r.y = base + Math.sin(now * 0.0014 + r.phase) * 12

        // 尾迹小气泡
        if (!r.entering && now > r.nextWake) {
          r.nextWake = now + 900 + Math.random() * 900
          const toRight = r.vx >= 0
          this.wakeList.push({
            id: 'w' + (++this.wakeSeq),
            left: r.x + (toRight ? r.w * 0.14 : r.w * 0.86),
            top: r.y + r.h * (0.35 + Math.random() * 0.3),
            size: 4 + Math.random() * 5,
            dir: toRight ? 'left' : 'right',
            until: now + 1400
          })
          wakesChanged = true
        }
      }

      if (!r.entering) {
        if (r.y < 8) r.y = 8
        if (r.y > H - r.h - 8) r.y = H - r.h - 8
      }

      // 姿态
      let rot = 0
      if (reacting) rot = Math.sin(now * 0.03) * 7
      if (r.kind === 'jelly') {
        const pulse = 1 + Math.sin(now * 0.002 + r.phase) * 0.035
        r.imgTransform = `scale(${pulse.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`
      } else {
        const flip = (r.vx >= 0 ? 1 : -1) * (r.baseFlip ? -1 : 1)
        if (r.kind === 'fish') {
          const beat = Math.sin(now * 0.008 + r.phase)
          const sx = flip * (1 + beat * 0.025)
          const sy = 1 - beat * 0.018
          const tilt = Math.cos(now * 0.0014 + r.phase) * 6
          r.imgTransform = `scaleX(${sx.toFixed(3)}) scaleY(${sy.toFixed(3)}) rotate(${(tilt + rot).toFixed(1)}deg)`
        } else {
          r.imgTransform = `scaleX(${flip}) rotate(${rot.toFixed(1)}deg)`
        }
      }

      if (r.say && now > r.sayUntil) r.say = ''
    })

    // 清理过期尾迹
    const before = this.wakeList.length
    this.wakeList = this.wakeList.filter((w: Wake) => w.until > now)
    if (this.wakeList.length !== before) wakesChanged = true

    if (this.data.residents.length !== this.runtime.length) {
      this.renderStatic()
    }

    const patch: Record<string, any> = {}
    this.runtime.forEach((r: Runtime, i: number) => {
      const base = 'residents[' + i + ']'
      patch[base + '.transform'] = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`
      patch[base + '.imgTransform'] = r.imgTransform || 'scaleX(1)'
      patch[base + '.say'] = r.say || ''
    })
    if (wakesChanged) patch.wakes = this.wakeList
    this.setData(patch)
  },

  onTapResident(e: any) {
    const id = String((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '')
    const r = this.runtime.find((item: Runtime) => item.id === id)
    if (!r) return
    r.reactUntil = Date.now() + 860
    r.say = SAY_WORDS[Math.floor(Math.random() * SAY_WORDS.length)]
    r.sayUntil = Date.now() + 900
  },

  onAdd() {
    // 上传抠图需要登录；未登录先去登录页
    if (!requireLogin()) return
    wx.navigateTo({ url: '/pages/aquarium-add/aquarium-add' })
  },

  onClear() {
    if (!this.runtime.length) return
    wx.showModal({
      title: '清空潮池',
      content: '确定要送走所有住客吗？',
      confirmText: '清空',
      success: (res: any) => {
        if (!res.confirm) return
        clearResidents()
        this.stopLoop()
        this.runtime = []
        this.wakeList = []
        this.setData({ residents: [], wakes: [], count: 0, empty: true })
        toast('潮池清空了')
      }
    })
  },

  onShareAppMessage() {
    return {
      title: '我的潮池 · 把海边遇见的朋友请进来',
      path: '/pages/aquarium/aquarium'
    }
  }
})
