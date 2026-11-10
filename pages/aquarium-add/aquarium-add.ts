import http from '../../utils/http'
import { chooseImage, compressForUpload, mediaUrl, uploadContentUrl } from '../../utils/upload'
import { pick, showError, toast } from '../../utils/format'
import { requireLogin } from '../../utils/auth'
import { ResidentKind, addResident } from '../../utils/aquariumStore'

type Point = { x: number; y: number }

Page({
  data: {
    step: 'pick',
    photoPath: '',
    cutoutPath: '',
    canvasW: 0,
    canvasH: 0,
    name: '',
    kind: 'fish' as ResidentKind,
    flipped: false,
    uploading: false,
    aiBusy: false,
    fromAi: false,
    aiSrc: '',
    aiWidth: 0,
    aiHeight: 0,
    hint: '可以点上面的「AI 自动抠图」，也可以沿着小生物手动描一圈'
  },

  // ===== 画布状态（不参与渲染）=====
  canvas: null as any,
  ctx: null as any,
  photo: null as any,
  points: [] as Point[],
  drawing: false,
  cw: 0,
  ch: 0,
  dx: 0,
  dy: 0,
  dw: 0,
  dh: 0,
  dpr: 1,
  canvasRect: null as any,
  outW: 0,
  outH: 0,
  lastDrawAt: 0,
  cutting: false,
  aiToken: 0,

  onPick() {
    chooseImage()
      .then((path: string) => this.loadPhoto(path))
      .catch((err: any) => {
        if (err && err.message === 'cancel') return
        toast('选择图片失败')
      })
  },

  /** AI 抠图：原图上传后端，后端 rembg 分割后返回透明贴纸 URL */
  async onAiCut() {
    if (this.data.aiBusy || !this.data.photoPath) return
    const token = ++this.aiToken
    this.setData({ aiBusy: true })
    wx.showLoading({ title: 'AI 抠图中', mask: true })
    try {
      const compressed = await compressForUpload(this.data.photoPath)
      const data: any = await http.upload(
        '/aquarium/cutout',
        compressed,
        {},
        { timeout: 60000 }
      )
      if (token !== this.aiToken) return
      const uploadId = pick(data, 'uploadId', 'upload_id', 'id')
      const rawUrl = pick(data, 'url', 'contentUrl') || (uploadId ? uploadContentUrl(String(uploadId)) : '')
      if (!rawUrl) throw new Error('AI 没有返回图片')
      const src = mediaUrl(String(rawUrl))
      let width = Number(pick(data, 'width')) || 0
      let height = Number(pick(data, 'height')) || 0

      // 和手动上传一样：先确认小程序真的能读到这张图，避免住客“看不见”
      try {
        const info: any = await new Promise((resolve, reject) => {
          wx.getImageInfo({ src, success: resolve, fail: reject })
        })
        if (info && Number(info.width) > 0) {
          width = Number(info.width)
          height = Number(info.height)
        }
      } catch (e) {
        throw new Error('AI 图片地址无法读取，请检查图片域名白名单')
      }

      this.outW = width
      this.outH = height
      this.setData({
        step: 'preview',
        cutoutPath: src,
        fromAi: true,
        aiSrc: src,
        aiWidth: width,
        aiHeight: height,
        name: this.data.name || '小生物'
      })
    } catch (err: any) {
      if (token !== this.aiToken) return
      if (Number(err && err.code) === 40101) {
        requireLogin()
        return
      }
      const message = (err && err.message) || 'AI 抠图失败'
      toast(String(message).slice(0, 18))
      this.setData({ hint: 'AI 没成功，可以沿着小生物手动描一圈' })
    } finally {
      if (token === this.aiToken) {
        wx.hideLoading()
        this.setData({ aiBusy: false })
      }
    }
  },

  loadPhoto(path: string) {
    wx.getImageInfo({
      src: path,
      success: (info: any) => {
        const sys = wx.getSystemInfoSync()
        const maxW = Math.max(220, Number(sys.windowWidth) - 64)
        const maxH = Math.min(Number(sys.windowHeight) * 0.46, 420)
        const scale = Math.min(maxW / info.width, maxH / info.height)
        const pad = 12
        const dw = Math.max(120, Math.round(info.width * scale))
        const dh = Math.max(120, Math.round(info.height * scale))

        this.cw = dw + pad * 2
        this.ch = dh + pad * 2
        this.dx = pad
        this.dy = pad
        this.dw = dw
        this.dh = dh
        this.points = []
        this.outW = 0
        this.outH = 0
        this.cutting = false

        this.setData({
          step: 'edit',
          photoPath: path,
          canvasW: this.cw,
          canvasH: this.ch,
          flipped: false,
          fromAi: false,
          aiSrc: '',
          aiWidth: 0,
          aiHeight: 0,
          hint: '可以点上面的「AI 自动抠图」，也可以沿着小生物手动描一圈'
        })
        wx.nextTick(() => this.setupCanvas(path))
      },
      fail: () => toast('图片读取失败，换一张试试')
    })
  },

  setupCanvas(path: string, retry = 0) {
    const query = this.createSelectorQuery()
    query.select('#cutCanvas').fields({ node: true, size: true }).exec((res: any[]) => {
      const target = res && res[0]
      if (!target || !target.node) {
        if (retry < 3) {
          setTimeout(() => this.setupCanvas(path, retry + 1), 60)
          return
        }
        toast('画布初始化失败')
        return
      }
      const canvas = target.node
      const dpr = Number(wx.getSystemInfoSync().pixelRatio) || 1
      canvas.width = Math.round(this.cw * dpr)
      canvas.height = Math.round(this.ch * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        toast('画布初始化失败')
        return
      }
      ctx.scale(dpr, dpr)
      this.canvas = canvas
      this.ctx = ctx
      this.dpr = dpr

      const img = canvas.createImage()
      img.onload = () => {
        this.photo = img
        this.draw()
        this.createSelectorQuery()
          .select('#cutCanvas')
          .boundingClientRect((rect: any) => { this.canvasRect = rect })
          .exec()
      }
      img.onerror = () => toast('图片加载失败，换一张试试')
      img.src = path
    })
  },

  draw() {
    if (!this.ctx || !this.photo) return
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.cw, this.ch)
    ctx.drawImage(this.photo, this.dx, this.dy, this.dw, this.dh)

    if (this.points.length < 2) return
    ctx.save()
    ctx.beginPath()
    this.points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.closePath()
    ctx.fillStyle = 'rgba(47, 179, 196, .16)'
    ctx.fill()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'rgba(7, 24, 34, .45)'
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  },

  touchPoint(e: any): Point | null {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return null
    let x = Number(t.x)
    let y = Number(t.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (!this.canvasRect) return null
      x = Number(t.clientX) - this.canvasRect.left
      y = Number(t.clientY) - this.canvasRect.top
    }
    return {
      x: Math.max(0, Math.min(this.cw, x)),
      y: Math.max(0, Math.min(this.ch, y))
    }
  },

  onTouchStart(e: any) {
    if (this.data.step !== 'edit') return
    const p = this.touchPoint(e)
    if (!p) return
    this.drawing = true
    this.points = [p]
    this.lastDrawAt = 0
    this.draw()
  },

  onTouchMove(e: any) {
    if (!this.drawing) return
    const p = this.touchPoint(e)
    if (!p) return
    const last = this.points[this.points.length - 1]
    if (last) {
      const dist = Math.sqrt((p.x - last.x) * (p.x - last.x) + (p.y - last.y) * (p.y - last.y))
      if (dist < 2) return
    }
    this.points.push(p)
    const now = Date.now()
    if (now - this.lastDrawAt < 16) return
    this.lastDrawAt = now
    this.draw()
  },

  onTouchEnd() {
    if (!this.drawing) return
    this.drawing = false
    if (this.points.length < 3) this.points = []
    this.draw()
    if (this.points.length >= 3) {
      this.setData({ hint: '描好了，点「生成贴纸」把它请出来' })
    }
  },

  onRetake() {
    this.aiToken++
    this.points = []
    this.photo = null
    this.canvas = null
    this.ctx = null
    this.cutting = false
    this.outW = 0
    this.outH = 0
    this.setData({
      step: 'pick',
      photoPath: '',
      cutoutPath: '',
      canvasW: 0,
      canvasH: 0,
      flipped: false,
      aiBusy: false,
      fromAi: false,
      aiSrc: '',
      aiWidth: 0,
      aiHeight: 0
    })
  },

  onBackEdit() {
    if (!this.data.photoPath) {
      this.setData({ step: 'pick' })
      return
    }
    this.aiToken++
    this.points = []
    this.cutting = false
    this.setData({ step: 'edit', cutoutPath: '', aiBusy: false, fromAi: false, aiSrc: '' })
    wx.nextTick(() => {
      this.cw = this.data.canvasW
      this.ch = this.data.canvasH
      // canvas 尺寸可能被导出步骤改过，重新按原图设置
      wx.getImageInfo({
        src: this.data.photoPath,
        success: (info: any) => {
          const sys = wx.getSystemInfoSync()
          const maxW = Math.max(220, Number(sys.windowWidth) - 64)
          const maxH = Math.min(Number(sys.windowHeight) * 0.46, 420)
          const scale = Math.min(maxW / info.width, maxH / info.height)
          const pad = 12
          const dw = Math.max(120, Math.round(info.width * scale))
          const dh = Math.max(120, Math.round(info.height * scale))
          this.cw = dw + pad * 2
          this.ch = dh + pad * 2
          this.dx = pad
          this.dy = pad
          this.dw = dw
          this.dh = dh
          this.setData({ canvasW: this.cw, canvasH: this.ch })
          wx.nextTick(() => this.setupCanvas(this.data.photoPath))
        },
        fail: () => {
          toast('图片读取失败，重新选择')
          this.setData({ step: 'pick' })
        }
      })
    })
  },

  onCut() {
    if (this.cutting) return
    if (!this.ctx || !this.photo) return
    if (this.points.length < 3) {
      toast('先沿着小生物描一圈')
      return
    }
    this.cutting = true

    let minX = this.cw
    let minY = this.ch
    let maxX = 0
    let maxY = 0
    this.points.forEach((p) => {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    })

    const pad = 18
    this.outW = Math.max(1, Math.round(maxX - minX + pad * 2))
    this.outH = Math.max(1, Math.round(maxY - minY + pad * 2))
    const ox = -minX + pad
    const oy = -minY + pad

    const canvas = this.canvas
    if (!canvas) {
      this.cutting = false
      toast('画布状态异常，请重新选图')
      return
    }
    canvas.width = Math.round(this.outW * this.dpr)
    canvas.height = Math.round(this.outH * this.dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      this.cutting = false
      toast('生成失败，请重试')
      return
    }
    ctx.scale(this.dpr, this.dpr)
    ctx.clearRect(0, 0, this.outW, this.outH)

    // 只保留描边路径内的照片
    ctx.save()
    ctx.beginPath()
    this.points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x + ox, p.y + oy)
      else ctx.lineTo(p.x + ox, p.y + oy)
    })
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(this.photo, this.dx + ox, this.dy + oy, this.dw, this.dh)
    ctx.restore()

    // 自检：取描边区域中心点，确认裁剪后不是全透明
    let sumX = 0
    let sumY = 0
    this.points.forEach((p) => { sumX += p.x; sumY += p.y })
    const sampleX = Math.round((sumX / this.points.length + ox) * this.dpr)
    const sampleY = Math.round((sumY / this.points.length + oy) * this.dpr)
    const sample = ctx.getImageData(sampleX, sampleY, 1, 1).data
    if (!sample || sample[3] === 0) {
      this.cutting = false
      toast('抠图区域是空的，请重新描一圈')
      return
    }

    // 贴纸边：黑外圈 + 白内圈 + 细黑线
    ctx.save()
    ctx.beginPath()
    this.points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x + ox, p.y + oy)
      else ctx.lineTo(p.x + ox, p.y + oy)
    })
    ctx.closePath()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1C1C1C'
    ctx.lineWidth = 16
    ctx.stroke()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 9
    ctx.stroke()
    ctx.strokeStyle = '#1C1C1C'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()

    wx.canvasToTempFilePath({
      canvas,
      fileType: 'png',
      quality: 1,
      success: (res: any) => {
        this.cutting = false
        this.setData({
          step: 'preview',
          cutoutPath: res.tempFilePath,
          fromAi: false,
          aiSrc: '',
          aiWidth: this.outW,
          aiHeight: this.outH,
          name: this.data.name || '小生物'
        })
      },
      fail: () => {
        this.cutting = false
        toast('生成贴纸失败，请重试')
      }
    })
  },

  onName(e: any) {
    this.setData({ name: (e.detail && e.detail.value) || '' })
  },

  onKind(e: any) {
    const kind = (e.currentTarget.dataset.kind || 'fish') as ResidentKind
    this.setData({ kind })
  },

  onFlip() {
    this.setData({ flipped: !this.data.flipped })
  },

  onPlace() {
    if (this.data.uploading) return
    if (!this.data.cutoutPath) {
      toast('还没有生成贴纸')
      return
    }

    // AI 结果已经存在服务器上，直接用它的 URL，不再重复上传
    if (this.data.fromAi && this.data.aiSrc) {
      this.setData({ uploading: true })
      const aspect = this.data.aiWidth > 0 ? this.data.aiHeight / this.data.aiWidth : 1
      addResident({
        id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: (this.data.name || '').trim() || '小生物',
        kind: this.data.kind,
        src: this.data.aiSrc,
        aspect,
        baseFlip: !!this.data.flipped,
        createdAt: Date.now()
      })
      wx.showToast({ title: '住进潮池啦', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
      return
    }

    this.setData({ uploading: true })

    http.upload('/uploads', this.data.cutoutPath, { scene: 'observation' })
      .then(async (data: any) => {
        const uploadId = pick(data, 'uploadId', 'upload_id', 'id')
        if (!uploadId) throw new Error('上传成功但未返回 uploadId')
        if (pick(data, 'status') === 'processing') {
          try {
            await http.post(`/uploads/${uploadId}/complete`, {})
          } catch (e) {
            // 本地直传一般已经是 approved，complete 失败不阻断
          }
        }
        const src = uploadContentUrl(String(uploadId))
        let aspect = this.outW > 0 ? this.outH / this.outW : 1

        // 上传成功不等于图片可访问：先确认小程序真的能读到这个 URL，
        // 否则住客会以“看不见”的状态进入潮池。
        try {
          const info: any = await new Promise((resolve, reject) => {
            wx.getImageInfo({ src, success: resolve, fail: reject })
          })
          if (info && Number(info.width) > 0) aspect = Number(info.height) / Number(info.width)
        } catch (e) {
          throw new Error('图片上传成功，但地址无法读取；请检查图片域名白名单')
        }

        addResident({
          id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: (this.data.name || '').trim() || '小生物',
          kind: this.data.kind,
          src,
          aspect,
          baseFlip: !!this.data.flipped,
          createdAt: Date.now()
        })
        wx.showToast({ title: '住进潮池啦', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 500)
      })
      .catch((err: any) => {
        if (Number(err && err.code) === 40101) {
          requireLogin()
          return
        }
        showError(err, '放入潮池失败')
      })
      .finally(() => this.setData({ uploading: false }))
  }
})
