import http from '../../utils/http'
import { chooseImage, compressForUpload, mediaUrl, uploadContentUrl } from '../../utils/upload'
import { pick, showError, toast } from '../../utils/format'
import { requireLogin } from '../../utils/auth'
import { ResidentKind, addResident, createResident } from '../../utils/aquariumStore'

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
    refineBusy: false,
    fromAi: false,
    aiSrc: '',
    aiWidth: 0,
    aiHeight: 0,
    rotate: 0,
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
  /** 选完照片时是否已经通过 AI 审核；通过后后续上传不再重复审 */
  audited: false,
  /** 审核阶段识别出的主体框（归一化 x,y,w,h），抠图前先裁到主体 */
  auditBox: '',
  /** 从「审核记录」进来的已通过图片：直接用这个 uploadId 抠图，不再重复上传 */
  fromUploadId: '',
  /** 当前贴纸在对象存储里的 key / 上传 id，保存住客时交给后端 */
  objectKey: '',
  uploadId: '',
  /** 审核接口识别出的物种名，用于潮池新物种奖励去重 */
  auditSpeciesName: '',

  /** 入口：潮池页选完图直接带 photo 进来；审核记录带 uploadId/src 进来 */
  onLoad(query: any) {
    const photo = query && query.photo
    if (photo) {
      this.loadPhoto(decodeURIComponent(String(photo)))
      return
    }
    const uploadId = query && query.uploadId
    const src = query && query.src
    if (!uploadId || !src) {
      wx.navigateBack()
      return
    }
    this.fromUploadId = String(uploadId)
    this.audited = true
    const url = decodeURIComponent(String(src))
    wx.getImageInfo({
      src: url,
      success: (info: any) => this.enterEdit(url, info),
      fail: () => {
        toast('图片加载失败，请重新选择')
        setTimeout(() => wx.navigateBack(), 300)
      }
    })
  },

  onPick() {
    this.fromUploadId = ''
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

    // showLoading 和 showModal / showToast 共用同一个原生视图：
    // 必须先 hideLoading，再弹提示，否则后弹的提示会被关掉（看起来“闪一下”）。
    let loading = true
    const stopLoading = () => {
      if (!loading) return
      loading = false
      wx.hideLoading()
    }

    try {
      let data: any
      if (this.fromUploadId) {
        // 已人工通过的图：后端已有原图，直接对它补做抠图
        data = await http.post(
          `/aquarium/cutout/${this.fromUploadId}`,
          {},
          { timeout: 60000 }
        )
      } else {
        const compressed = await compressForUpload(this.data.photoPath)
        data = await http.upload(
          '/aquarium/cutout',
          compressed,
          { audited: this.audited ? '1' : '', box: this.auditBox },
          { timeout: 60000 }
        )
      }
      if (token !== this.aiToken) return
      stopLoading()

      const uploadId = pick(data, 'uploadId', 'upload_id', 'id')

      // AI 初审驳回：弹窗说明原因，并给一次申诉机会（弹窗不会自动消失）
      if (String(pick(data, 'status') || '') === 'rejected') {
        const reason = String(pick(data, 'rejectReason') || '这张照片没有通过自动审核')
        const answer: any = await new Promise((resolve) => {
          wx.showModal({
            title: '照片未通过审核',
            content: reason + '。如果确认是海洋生物，可以提交人工复核。',
            confirmText: '申诉',
            cancelText: '取消',
            confirmColor: '#14A08A',
            success: resolve,
            fail: () => resolve({ confirm: false })
          })
        })
        if (answer && answer.confirm && uploadId) {
          try {
            await http.post(`/uploads/${uploadId}/appeal`, {})
            wx.showToast({ title: '已提交人工复核', icon: 'none' })
          } catch (e) {
            wx.showToast({ title: '申诉失败，请稍后再试', icon: 'none' })
          }
        }
        // 不 throw：throw 会落到 catch 再弹一次黑色 toast，重复提示
        return
      }

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
      this.objectKey = String(pick(data, 'objectKey') || '')
      this.uploadId = String(uploadId || '')
      this.setData({
        step: 'preview',
        cutoutPath: src,
        fromAi: true,
        aiSrc: src,
        aiWidth: width,
        aiHeight: height,
        name: this.data.name || '海洋生物'
      })
    } catch (err: any) {
      stopLoading()
      if (token !== this.aiToken) return
      if (Number(err && err.code) === 40101) {
        requireLogin()
        return
      }
      const message = String((err && err.message) || 'AI 抠图失败')
      // 这里用长一点的 toast，避免“只闪一下”
      wx.showToast({ title: message.slice(0, 18), icon: 'none' })
    } finally {
      stopLoading()
      if (token === this.aiToken) this.setData({ aiBusy: false })
    }
  },

  /** 选完照片：先做 AI 审核，通过后再进编辑 */
  /** AI 精修：本地 u2net 抠不干净（翻拍屏、反光、复杂背景）时，用千问图像编辑重抠。
   *  按张计费，后端限每天 20 次；保留当前贴纸，失败就不动。 */
  async onAiRefine() {
    if (this.data.aiBusy || this.data.refineBusy || !this.data.photoPath) return
    const token = ++this.aiToken
    this.setData({ refineBusy: true })
    wx.showLoading({ title: 'AI 精修中', mask: true })
    let loading = true
    const stopLoading = () => {
      if (!loading) return
      loading = false
      wx.hideLoading()
    }
    try {
      let data: any
      if (this.fromUploadId) {
        // 原图已经在服务器上，不用再上传一遍
        data = await http.post(
          `/aquarium/cutout/${this.fromUploadId}?engine=ai`,
          {},
          { timeout: 120000 }
        )
      } else {
        const compressed = await compressForUpload(this.data.photoPath)
        data = await http.upload(
          '/aquarium/cutout',
          compressed,
          { engine: 'ai', audited: this.audited ? '1' : '0', box: this.auditBox },
          { timeout: 120000 }
        )
      }
      if (token !== this.aiToken) return
      stopLoading()
      if (String(pick(data, 'status') || '') === 'rejected') {
        return
      }
      const uploadId = pick(data, 'uploadId', 'upload_id', 'id')
      const rawUrl = pick(data, 'url', 'contentUrl') || (uploadId ? uploadContentUrl(String(uploadId)) : '')
      if (!rawUrl) throw new Error('AI 没有返回图片')
      const src = mediaUrl(String(rawUrl))
      let width = Number(pick(data, 'width')) || 0
      let height = Number(pick(data, 'height')) || 0

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
      this.objectKey = String(pick(data, 'objectKey') || '')
      this.uploadId = String(uploadId || '')
      this.setData({
        cutoutPath: src,
        fromAi: true,
        aiSrc: src,
        aiWidth: width,
        aiHeight: height
      })
      wx.showToast({ title: '精修完成', icon: 'none' })
    } catch (err: any) {
      stopLoading()
      if (token !== this.aiToken) return
      if (Number(err && err.code) === 40101) {
        requireLogin()
        return
      }
      const message = (err && err.message) || 'AI 精修失败'
      wx.showToast({ title: String(message).slice(0, 18), icon: 'none' })
    } finally {
      stopLoading()
      if (token === this.aiToken) this.setData({ refineBusy: false })
    }
  },

  loadPhoto(path: string) {
    wx.getImageInfo({
      src: path,
      success: (info: any) => this.auditThenEdit(path, info),
      fail: () => toast('图片读取失败，换一张试试')
    })
  },

  /** 选图后立即审核：不是真实海洋生物就弹窗说明并停在选择页 */
  async auditThenEdit(path: string, info: any) {
    wx.showLoading({ title: '正在审核照片', mask: true })
    this.auditSpeciesName = ''
    let approved = false
    try {
      const compressed = await compressForUpload(path)
      const data: any = await http.upload(
        '/aquarium/audit',
        compressed,
        {},
        { timeout: 30000 }
      )
      wx.hideLoading()
      if (data && data.ok === false) {
        const reason = String(pick(data, 'rejectReason') || '这张照片没有通过审核')
        const uploadId = String(pick(data, 'uploadId') || '')
        const answer: any = await new Promise((resolve) => {
          wx.showModal({
            title: '照片未通过审核',
            content: reason + '。请换一张真实拍摄的海洋生物照片；如果确认没问题，可以提交人工复核。',
            confirmText: '申诉',
            cancelText: '知道了',
            confirmColor: '#14A08A',
            success: resolve,
            fail: () => resolve({ confirm: false })
          })
        })
        if (answer && answer.confirm && uploadId) {
          try {
            await http.post(`/uploads/${uploadId}/appeal`, {})
            wx.showToast({ title: '已提交人工复核', icon: 'none' })
          } catch (e) {
            wx.showToast({ title: '申诉失败，请稍后再试', icon: 'none' })
          }
        }
        setTimeout(() => wx.navigateBack(), 300)
        return
      }
      approved = true
      this.auditSpeciesName = String(pick(data, 'name') || '').slice(0, 64)
      const boxRaw = pick(data, 'box')
      if (Array.isArray(boxRaw) && boxRaw.length === 4) {
        this.auditBox = boxRaw.map((v: any) => Number(v)).join(',')
      } else {
        this.auditBox = ''
      }
    } catch (e) {
      // 审核接口异常：放行，后续上传时服务端还会再判一次
      wx.hideLoading()
      approved = false
      this.auditBox = ''
    }
    this.audited = approved
    this.enterEdit(path, info)
  },

  enterEdit(path: string, info: any) {
    this.objectKey = ''
    this.uploadId = ''
    {
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
          rotate: 0,
          fromAi: false,
          aiSrc: '',
          aiWidth: 0,
          aiHeight: 0
        })
        wx.nextTick(() => this.setupCanvas(path))
    }
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
  },

  onRetake() {
    this.onPick()
  },

  onBackEdit() {
    if (!this.data.photoPath) {
      wx.navigateBack()
      return
    }
    this.aiToken++
    this.points = []
    this.cutting = false
    this.setData({ step: 'edit', cutoutPath: '', aiBusy: false, refineBusy: false, fromAi: false, aiSrc: '' })
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
          toast('图片读取失败')
          setTimeout(() => wx.navigateBack(), 300)
        }
      })
    })
  },

  onCut() {
    if (this.cutting) return
    if (!this.ctx || !this.photo) return
    if (this.points.length < 3) {
      toast('先描出轮廓')
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
        this.objectKey = ''
        this.uploadId = ''
        this.setData({
          step: 'preview',
          cutoutPath: res.tempFilePath,
          fromAi: false,
          aiSrc: '',
          aiWidth: this.outW,
          aiHeight: this.outH,
          name: this.data.name || '海洋生物'
        })
      },
      fail: () => {
        this.cutting = false
        toast('生成失败，请重试')
      }
    })
  },

  onName(e: any) {
    this.setData({ name: (e.detail && e.detail.value) || '' })
  },

  onRotateChange(e: any) {
    const value = Number(e.detail && e.detail.value)
    this.setData({ rotate: Number.isFinite(value) ? value : 0 })
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
      toast('还没有生成抠图')
      return
    }
    this.setData({ uploading: true })

    // AI 结果已经存在服务器上，直接保存住客记录，不再重复上传
    if (this.data.fromAi && this.data.aiSrc) {
      const aspect = this.data.aiWidth > 0 ? this.data.aiHeight / this.data.aiWidth : 1
      this.saveResident({
        objectKey: this.objectKey || undefined,
        uploadId: this.objectKey ? undefined : this.uploadId || undefined,
        aspect
      })
      return
    }

    // scene=aquarium：后端在上传这一步就做「是不是海洋生物」的 AI 审核
    http.upload('/uploads', this.data.cutoutPath, {
      scene: 'aquarium',
      audited: this.audited ? '1' : ''
    })
      .then(async (data: any) => {
        const uploadId = pick(data, 'uploadId', 'upload_id', 'id')
        if (!uploadId) throw new Error('上传成功但未返回 uploadId')

        // 上传时被 AI 驳回：弹窗说明原因，并提供一次申诉机会
        if (String(pick(data, 'status') || '') === 'rejected') {
          const reason = String(pick(data, 'rejectReason') || '这张照片没有通过自动审核')
          const answer: any = await new Promise((resolve) => {
            wx.showModal({
              title: '照片未通过审核',
              content: reason + '。如果确认是海洋生物，可以提交人工复核。',
              confirmText: '申诉',
              cancelText: '取消',
              confirmColor: '#14A08A',
              success: resolve,
              fail: () => resolve({ confirm: false })
            })
          })
          if (answer && answer.confirm) {
            try {
              await http.post(`/uploads/${uploadId}/appeal`, {})
              wx.showToast({ title: '已提交人工复核', icon: 'none' })
            } catch (e) {
              wx.showToast({ title: '申诉失败，请稍后再试', icon: 'none' })
            }
          }
          // 不 throw：避免再弹一次黑色 toast
          this.setData({ uploading: false })
          return
        }
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

        const objectKey = String(pick(data, 'objectKey') || '')
        await this.saveResident({
          objectKey: objectKey || undefined,
          uploadId: objectKey ? undefined : String(uploadId),
          aspect
        })
      })
      .catch((err: any) => {
        if (Number(err && err.code) === 40101) {
          requireLogin()
          return
        }
        showError(err, '加入潮池失败')
        this.setData({ uploading: false })
      })
  },

  /** 保存到账号（图片已在桶里，这里只建住客记录），成功后写本机缓存 */
  async saveResident(input: { objectKey?: string; uploadId?: string; aspect: number }) {
    try {
      const resident = await createResident({
        name: (this.data.name || '').trim() || '海洋生物',
        kind: this.data.kind,
        objectKey: input.objectKey,
        uploadId: input.uploadId,
        sourceUploadId: this.fromUploadId || undefined,
        speciesName: this.auditSpeciesName || (this.data.name || '').trim(),
        aspect: input.aspect,
        rotation: this.data.rotate > 180 ? this.data.rotate - 360 : this.data.rotate,
        baseFlip: !!this.data.flipped
      })
      addResident(resident)
      const award = Number(resident.coinsAwarded) || 0
      wx.showToast({
        title: award > 0 ? '已加入潮池 +' + award + ' 代币' : '已加入潮池',
        icon: 'none'
      })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (err: any) {
      if (Number(err && err.code) === 40101) {
        requireLogin()
        return
      }
      showError(err, '保存到潮池失败')
    } finally {
      this.setData({ uploading: false })
    }
  }
})
