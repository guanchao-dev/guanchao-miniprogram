import {
  AquariumResident,
  AquariumSettings,
  ResidentKind,
  clearResidents,
  clearResidentsRemote,
  ensureDemoResident,
  fetchSettings,
  getLocalSettings,
  getResidents,
  removeResidentLocal,
  removeResidentRemote,
  saveLocalSettings,
  setResidentAdjustmentsLocal,
  syncResidents,
  updateResidentAdjustmentsRemote,
  updateSettings,
  uploadBackground
} from '../../utils/aquariumStore'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { chooseImage, compressForUpload } from '../../utils/upload'

type Runtime = {
  id: string
  name: string
  kind: ResidentKind
  src: string
  aspect: number
  scale: number
  rotation: number
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

const SAY_WORDS = ['游动中', '正在移动', '观察记录', '保持距离观察']

const KIND_NAMES: Record<string, string> = {
  fish: '游动',
  crab: '横移',
  snail: '爬行',
  jelly: '漂浮'
}

Page({
  data: {
    residents: [] as any[],
    wakes: [] as any[],
    count: 0,
    empty: false,
    loading: true,
    theme: 'day',
    landscape: false,
    backgroundUrl: '',
    bgBusy: false,
    menuOpen: false,
    fullscreen: false,
    sizeSheetOpen: false,
    sizeSheetId: '',
    manageOpen: false,
    manageList: [] as any[],
    sizeSheetName: '',
    sizeSheetValue: 100,
    sizeSheetRotation: 0,
    themeReveal: false,
    revealX: 0,
    revealY: 0,
    revealColor: ''
  },

  // ===== 页面实例字段（不参与渲染）=====
  runtime: [] as Runtime[],
  timer: null as any,
  tankW: 0,
  tankH: 0,
  lastTick: 0,
  wakeList: [] as Wake[],
  wakeSeq: 0,
  _onResize: null as any,
  _revealTimers: [] as any[],
  _themeSwitching: false,
  _sizeOriginalScale: 1,
  _sizeOriginalRotation: 0,

  onLoad() {
    // 横版是全屏展示：手机转过来后重新测量鱼缸、重排住客
    this._onResize = () => {
      if (this.data.fullscreen) {
        setTimeout(() => this.relayout(), 120)
      }
    }
    wx.onWindowResize(this._onResize)
  },

  onShow() {
    // 先应用本机外观，避免等网络时闪烁；登录用户随后以账号设置为准。
    const local = getLocalSettings()
    // 打开永远是竖版；横版只作为本次展示模式，不跟随上次状态
    this.setData({
      theme: local.theme,
      landscape: false,
      backgroundUrl: local.backgroundUrl,
      fullscreen: false,
      themeReveal: false
    })
    this._themeSwitching = false

    // 先渲染本机缓存，避免等网络时缸是空的；登录用户随后用账号数据覆盖。
    const cached = isLoggedIn() ? getResidents() : ensureDemoResident()
    this.applyList(cached)
    if (isLoggedIn()) {
      syncResidents()
        .then((list: AquariumResident[]) => this.applyList(list))
        .catch(() => {
          // 网络失败继续用本机缓存
        })
      fetchSettings()
        .then((s: AquariumSettings) => this.applySettings(s))
        .catch(() => {
          // 网络失败继续用本机外观
        })
    }
  },

  applySettings(s: AquariumSettings) {
    // 只同步主题和背景；横版是单次展示动作，不跟随账号设置
    this.setData({ theme: s.theme, backgroundUrl: s.backgroundUrl })
    saveLocalSettings({ theme: s.theme })
  },

  /** 横竖版切换后，缸的尺寸变了，所有住客要重新排一次 */
  relayout() {
    this.runtime.forEach((r: Runtime) => { r.initialized = false })
    this.measureTank()
  },

  onToggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  onCloseMenu() {
    this.setData({ menuOpen: false })
  },

  onSetOrientation(e: any) {
    const landscape = e.currentTarget.dataset.value === 'landscape'
    if (landscape === this.data.landscape && landscape === this.data.fullscreen) {
      this.setData({ menuOpen: false })
      return
    }
    this.setData({ landscape, fullscreen: landscape, menuOpen: false })
    if (landscape) toast('把手机横过来看')
    setTimeout(() => this.relayout(), 120)
  },

  onExitFullscreen() {
    this.setData({ landscape: false, fullscreen: false, menuOpen: false })
    setTimeout(() => this.relayout(), 120)
  },

  onSetTheme(e: any) {
    const theme = e.currentTarget.dataset.value === 'night' ? 'night' : 'day'
    this.setData({ menuOpen: false })
    if (theme === this.data.theme || this._themeSwitching) return

    // 从点击位置扩散：先拿鱼缸位置，再启动圆形覆盖层
    this.createSelectorQuery()
      .select('.tank')
      .boundingClientRect((rect: any) => {
        if (!rect) {
          this.applyTheme(theme)
          return
        }
        const detail = e.detail || {}
        const pageX = Number(detail.x)
        const pageY = Number(detail.y)
        const x = Number.isFinite(pageX) ? pageX - rect.left : rect.width / 2
        const y = Number.isFinite(pageY) ? pageY - rect.top : rect.height / 2
        this.startThemeReveal(theme, Math.max(0, x), Math.max(0, y))
      })
      .exec()
  },

  applyTheme(theme: 'day' | 'night') {
    this.setData({ theme })
    saveLocalSettings({ theme })
    if (isLoggedIn()) {
      updateSettings({ theme }).catch(() => toast('设置同步失败'))
    }
  },

  startThemeReveal(theme: 'day' | 'night', x: number, y: number) {
    this._themeSwitching = true
    this.setData({
      themeReveal: true,
      revealX: x,
      revealY: y,
      revealColor:
        theme === 'night'
          ? 'linear-gradient(180deg, #243B57 0%, #0A1424 100%)'
          : 'linear-gradient(180deg, #B7DDE2 0%, #7FB4BC 100%)'
    })

    // 60% 时在覆盖层下面切换主题，最后淡出移除
    const swap = setTimeout(() => this.applyTheme(theme), 250)
    const done = setTimeout(() => {
      this.setData({ themeReveal: false })
      this._themeSwitching = false
    }, 460)
    this._revealTimers.push(swap, done)
  },

  onChangeBackground() {
    if (this.data.bgBusy) return
    this.setData({ menuOpen: false })
    if (!requireLogin()) return
    chooseImage()
      .then(async (path: string) => {
        this.setData({ bgBusy: true })
        wx.showLoading({ title: '审核中', mask: true })
        try {
          const compressed = await compressForUpload(path)
          const data: any = await uploadBackground(compressed)
          wx.hideLoading()
          if (data && data.ok === false) {
            wx.showModal({
              title: '背景未通过审核',
              content: String(data.rejectReason || '图片未通过合规审核'),
              showCancel: false
            })
            return
          }
          this.setData({ backgroundUrl: String(data.backgroundUrl || '') })
          saveLocalSettings({
            backgroundKey: String(data.backgroundKey || ''),
            backgroundUrl: String(data.backgroundUrl || '')
          })
        } catch (err: any) {
          wx.hideLoading()
          if (Number(err && err.code) === 40101) {
            requireLogin()
            return
          }
          showError(err, '背景上传失败')
        } finally {
          this.setData({ bgBusy: false })
        }
      })
      .catch((err: any) => {
        if (err && err.message === 'cancel') return
        toast('选择图片失败')
      })
  },

  onResetBackground() {
    if (!this.data.backgroundUrl) return
    this.setData({ backgroundUrl: '', menuOpen: false })
    saveLocalSettings({ backgroundKey: '', backgroundUrl: '' })
    if (isLoggedIn()) {
      updateSettings({ backgroundKey: '' }).catch(() => toast('设置同步失败'))
    }
  },

  applyList(list: AquariumResident[]) {
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
    if (this._onResize) wx.offWindowResize(this._onResize)
    this._revealTimers.forEach((t: any) => clearTimeout(t))
    this._revealTimers = []
    this.stopLoop()
  },

  measureTank() {
    // 横版是全屏旋转 90°：内部坐标宽高与屏幕互换，不能再用旋转后的 boundingRect
    if (this.data.fullscreen) {
      const sys = wx.getSystemInfoSync()
      this.tankW = Number(sys.windowHeight) || 667
      this.tankH = Number(sys.windowWidth) || 375
      this.runtime.forEach((r: Runtime) => {
        if (!r.initialized) this.layout(r)
      })
      if (this.runtime.length) {
        this.renderStatic()
        this.startLoop()
      }
      return
    }

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
        old.scale = item.scale || 1
        old.rotation = item.rotation || 0
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
      scale: item.scale || 1,
      rotation: item.rotation || 0,
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
    r.size = Math.round(baseSize * scale * (r.scale || 1))
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
        r.imgTransform = `scale(${pulse.toFixed(3)}) rotate(${(rot + r.rotation).toFixed(1)}deg)`
      } else {
        const flip = (r.vx >= 0 ? 1 : -1) * (r.baseFlip ? -1 : 1)
        if (r.kind === 'fish') {
          const beat = Math.sin(now * 0.008 + r.phase)
          const sx = flip * (1 + beat * 0.025)
          const sy = 1 - beat * 0.018
          const tilt = Math.cos(now * 0.0014 + r.phase) * 6
          r.imgTransform = `scaleX(${sx.toFixed(3)}) scaleY(${sy.toFixed(3)}) rotate(${(tilt + rot + r.rotation).toFixed(1)}deg)`
        } else {
          r.imgTransform = `scaleX(${flip}) rotate(${(rot + r.rotation).toFixed(1)}deg)`
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

  onManage() {
    if (this.data.fullscreen) {
      toast('退出横版后再管理')
      return
    }
    this.setData({
      sizeSheetOpen: false,
      manageOpen: true,
      manageList: this.buildManageList()
    })
  },

  onCloseManage() {
    this.setData({ manageOpen: false })
  },

  buildManageList(): any[] {
    return getResidents().map((r) => ({
      id: r.id,
      name: r.name,
      src: r.src,
      kindName: KIND_NAMES[r.kind] || ''
    }))
  },

  onDeleteResident(e: any) {
    const id = String((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '')
    if (!id) return
    wx.showModal({
      title: '删除生物',
      content: '确定从潮池中删除这个生物吗？',
      confirmText: '删除',
      confirmColor: '#C0392B',
      success: (res: any) => {
        if (!res.confirm) return
        this.deleteResidentById(id)
      }
    })
  },

  onDeleteFromSheet() {
    const id = this.data.sizeSheetId
    if (!id) return
    wx.showModal({
      title: '删除生物',
      content: '确定从潮池中删除这个生物吗？',
      confirmText: '删除',
      confirmColor: '#C0392B',
      success: (res: any) => {
        if (!res.confirm) return
        this.deleteResidentById(id)
      }
    })
  },

  async deleteResidentById(id: string) {
    if (isLoggedIn()) {
      try {
        await removeResidentRemote(id)
      } catch (err) {
        showError(err, '删除失败')
        return
      }
    }
    removeResidentLocal(id)
    const list = getResidents()
    this.setData({
      sizeSheetOpen: false,
      sizeSheetId: '',
      manageList: this.buildManageList(),
      manageOpen: this.data.manageOpen && list.length > 0
    })
    this.applyList(list)
    toast('已删除')
  },

  /** 长按住客：弹出大小调节 */
  onResidentLongPress(e: any) {
    if (this.data.fullscreen) {
      toast('退出横版后再调整大小')
      return
    }
    const id = String((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '')
    const r = this.runtime.find((item: Runtime) => item.id === id)
    if (!r) return
    this._sizeOriginalScale = r.scale || 1
    this._sizeOriginalRotation = r.rotation || 0
    this.setData({
      manageOpen: false,
      sizeSheetOpen: true,
      sizeSheetId: id,
      sizeSheetName: r.name,
      sizeSheetValue: Math.round((r.scale || 1) * 100),
      sizeSheetRotation: ((r.rotation || 0) + 360) % 360
    })
  },

  onSizeSheetChanging(e: any) {
    const value = Number(e.detail && e.detail.value)
    if (!Number.isFinite(value)) return
    this.applySheetScale(value)
  },

  applySheetScale(value: number) {
    const id = this.data.sizeSheetId
    const r = this.runtime.find((item: Runtime) => item.id === id)
    if (!r) return
    r.scale = value / 100
    this.resizeRuntime(r)
    const idx = this.data.residents.findIndex((item: any) => item.id === id)
    const patch: Record<string, any> = { sizeSheetValue: value }
    if (idx >= 0) patch[`residents[${idx}].size`] = r.size
    this.setData(patch)
  },

  onSheetRotateChanging(e: any) {
    const value = Number(e.detail && e.detail.value)
    if (!Number.isFinite(value)) return
    const r = this.runtime.find((item: Runtime) => item.id === this.data.sizeSheetId)
    if (!r) return
    r.rotation = value > 180 ? value - 360 : value
    this.setData({ sizeSheetRotation: value })
  },

  resizeRuntime(r: Runtime) {
    const scale = Math.max(0.8, Math.min(1.12, this.tankW / 820))
    const baseSize = r.kind === 'fish' ? 136 : r.kind === 'crab' ? 124 : r.kind === 'snail' ? 100 : 116
    r.size = Math.round(baseSize * scale * (r.scale || 1))
    r.w = r.size
    r.h = Math.max(20, Math.round(r.size * (r.aspect || 1)))
  },

  onCloseSizeSheet() {
    if (this.data.sizeSheetOpen) {
      this.applySheetScale(Math.round((this._sizeOriginalScale || 1) * 100))
      const r = this.runtime.find((item: Runtime) => item.id === this.data.sizeSheetId)
      if (r) r.rotation = this._sizeOriginalRotation
    }
    this.setData({ sizeSheetOpen: false, sizeSheetId: '' })
  },

  onSaveSize() {
    const id = this.data.sizeSheetId
    const scale = (this.data.sizeSheetValue || 100) / 100
    const rotation = this.data.sizeSheetRotation > 180
      ? this.data.sizeSheetRotation - 360
      : this.data.sizeSheetRotation
    setResidentAdjustmentsLocal(id, scale, rotation)
    if (isLoggedIn()) {
      updateResidentAdjustmentsRemote(id, scale, rotation).catch(() => toast('调整同步失败'))
    }
    this.setData({ sizeSheetOpen: false, sizeSheetId: '' })
    toast('已保存调整')
  },

  onAuditLog() {
    wx.navigateTo({ url: '/pages/aquarium-audit/aquarium-audit' })
  },

  onAdd() {
    // 直接拉起拍照/相册，选完再进抠图页，少一层空白选择页
    if (!requireLogin()) return
    chooseImage()
      .then((path: string) => {
        wx.navigateTo({
          url: '/pages/aquarium-add/aquarium-add?photo=' + encodeURIComponent(path)
        })
      })
      .catch((err: any) => {
        if (err && err.message === 'cancel') return
        toast('选择图片失败')
      })
  },

  onClear() {
    if (!this.runtime.length && !(this.data.manageList || []).length) return
    wx.showModal({
      title: '清空潮池',
      content: '确定要清空潮池中的所有生物吗？',
      confirmText: '清空',
      success: async (res: any) => {
        if (!res.confirm) return
        if (isLoggedIn()) {
          try {
            await clearResidentsRemote()
          } catch (e) {
            toast('清空失败，请稍后再试')
            return
          }
        }
        clearResidents()
        this.stopLoop()
        this.runtime = []
        this.wakeList = []
        this.setData({
          residents: [],
          wakes: [],
          count: 0,
          empty: true,
          manageOpen: false,
          manageList: [],
          sizeSheetOpen: false
        })
        toast('已清空潮池')
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
