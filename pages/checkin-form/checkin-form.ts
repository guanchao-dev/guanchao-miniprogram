import { BASE_URL } from '../../config/env'
import { contentApi } from '../../services/api'
import { nowISO, showError, toast } from '../../utils/format'

const GRID = 0.003 // 约 300 米，坐标按此网格取整后再提交

Page({
  data: {
    mode: '',             // ''=选择 | 'join'=进行签到 | 'create'=设定签到 | 'records'=名单
    // 进行签到
    name: '',
    studentNo: '',
    keyInput: '',
    session: null,        // 密钥对应的活动
    verifying: false,
    locating: false,
    located: false,
    lat: 0,
    lng: 0,
    coordText: '',
    distanceText: '',
    inFence: false,
    scanning: false,
    submitting: false,
    result: null,
    // 设定签到
    placeName: '',
    address: '',
    fenceLat: 0,
    fenceLng: 0,
    fenceScale: 15,
    markers: [] as Array<any>,
    circles: [] as Array<any>,
    polygons: [] as Array<any>,
    polyPoints: [] as Array<any>,  // 手绘多边形的顶点 [{latitude, longitude}]
    mapLat: 36.083,             // 地图中心（选点后跟着走）
    mapLng: 120.468,
    creating: false,
    created: null,
    qrUrl: '',
    mySessions: [],
    myLoading: true,
    // 名单
    records: null,
    recordsLoading: false,
    detailSession: null   // 我发起的签到：点开看密钥与二维码
  },

  onLoad() {
    this.loadMine()
  },

  onShow() {
    if (this.data.mode === '' ) this.loadMine()
  },

  pickMode(e: any) {
    const mode = e.currentTarget.dataset.mode
    this.setData({
      mode,
      result: null,
      created: null,
      qrUrl: '',
      records: null,
      session: null,
      keyInput: '',
      located: false,
      lat: 0,
      lng: 0,
      coordText: '',
      distanceText: '',
      inFence: false
    })
    if (mode === 'create') this.loadMine()
  },

  back() {
    this.setData({ mode: '' })
    this.loadMine()
  },

  // ===================== 设定签到（组织者） =====================

  /** 地图选点：微信原生选点页，支持搜索地点名 */
  choosePlace() {
    wx.chooseLocation({
      success: (res: any) => {
        this.setData({
          placeName: res.name || res.address || '所选地点',
          address: res.address || '',
          fenceLat: res.latitude,
          fenceLng: res.longitude,
          mapLat: res.latitude,
          mapLng: res.longitude,
          // 换地点后旧的顶点作废
          polyPoints: []
        })
        this.syncFenceMap()
      },
      fail: (err: any) => {
        if (err && String(err.errMsg).indexOf('cancel') >= 0) return
        // 未授权定位时 chooseLocation 也会失败
        if (err && String(err.errMsg).indexOf('auth') >= 0) {
          toast('请先在设置里允许获取位置')
          return
        }
        toast('地图选点失败，请检查定位权限')
      }
    })
  },

  /** 地图上点一下 = 加一个多边形顶点 */
  onMapTap(e: any) {
    const d = e.detail || {}
    const lat = Number(d.latitude)
    const lng = Number(d.longitude)
    if (!lat || !lng) return
    const pts = this.data.polyPoints.concat([{ latitude: lat, longitude: lng }])
    this.setData({ polyPoints: pts })
    this.syncFenceMap()
  },

  undoPoint() {
    if (!this.data.polyPoints.length) return
    const pts = this.data.polyPoints.slice(0, -1)
    this.setData({ polyPoints: pts })
    this.syncFenceMap()
  },

  clearPoints() {
    this.setData({ polyPoints: [] })
    this.syncFenceMap()
  },

  /** 把描好的多边形画到地图上 */
  syncFenceMap() {
    const lat = this.data.mapLat
    const lng = this.data.mapLng
    if (!lat || !lng) return
    const pts = this.data.polyPoints
    this.setData({
      // 顶点用 marker 标出来，方便看到描到哪了
      markers: pts.map((p: any, i: number) => ({
        id: i + 1, latitude: p.latitude, longitude: p.longitude, width: 18, height: 18
      })),
      polygons: pts.length >= 3
        ? [{
            points: pts,
            strokeWidth: 2,
            strokeColor: '#1878FFCC',
            fillColor: '#1878FF33',
            zIndex: 1
          }]
        : []
    })
  },

  onCreate() {
    if (this.data.creating) return
    if (!this.data.placeName || !this.data.fenceLat) {
      toast('请先在地图上选择签到地点')
      return
    }
    this.setData({ creating: true })
    if (this.data.polyPoints.length < 3) {
      toast('请在地图上至少点 3 个顶点圈出签到范围')
      return
    }
    contentApi.createCheckinSession({
      name: '研学报到',
      placeName: this.data.placeName,
      address: this.data.address,
      lat: this.data.fenceLat,
      lng: this.data.fenceLng,
      // 多边形围栏：顶点按 [lng, lat] 传（与地图 API 一致）
      polygon: this.data.polyPoints.map((p: any) => [p.longitude, p.latitude])
    })
      .then((res: any) => {
        const created = res || {}
        this.setData({
          created,
          qrUrl: created.sessionId
            ? `${BASE_URL}/checkin-sessions/${created.sessionId}/qrcode`
            : ''
        })
        this.loadMine()
      })
      .catch((err) => showError(err, '创建失败'))
      .finally(() => this.setData({ creating: false }))
  },

  copyKey() {
    const key = this.data.created && this.data.created.key
    if (!key) return
    wx.setClipboardData({ data: key, success: () => toast('密钥已复制') })
  },

  loadMine() {
    this.setData({ myLoading: true })
    contentApi.myCheckinSessions()
      .then((res) => this.setData({ mySessions: (res && res.list) || [] }))
      .catch(() => this.setData({ mySessions: [] }))
      .finally(() => this.setData({ myLoading: false }))
  },

  // ===================== 进行签到（参与者） =====================

  onKeyInput(e: any) {
    this.setData({ keyInput: (e.detail.value || '').toUpperCase() })
  },

  /** 扫码填入密钥（组织者可以把密钥做成二维码给参与者扫） */
  scanKey() {
    if (this.data.scanning) return
    this.setData({ scanning: true })
    wx.scanCode({
      success: (res: any) => {
        const raw = (res.result || '').trim()
        // 支持纯密钥，也支持把密钥贴在链接/文本末尾的二维码
        const m = raw.match(/([A-Z0-9]{6})\s*$/i)
        const key = (m ? m[1] : raw).toUpperCase()
        this.setData({ keyInput: key })
        this.verifyKey()
      },
      fail: (err: any) => {
        if (!err || String(err.errMsg).indexOf('cancel') < 0) toast('扫码失败')
      },
      complete: () => this.setData({ scanning: false })
    })
  },

  onVerify() {
    this.verifyKey()
  },

  verifyKey() {
    const key = (this.data.keyInput || '').trim().toUpperCase()
    if (key.length < 6) {
      toast('请输入 6 位签到密钥')
      return
    }
    this.setData({ verifying: true })
    contentApi.checkinSessionByKey(key)
      .then((res: any) => {
        this.setData({ session: res, keyInput: key, distanceText: '', inFence: false })
        toast('密钥有效')
        this.locate()
      })
      .catch((err) => {
        this.setData({ session: null })
        showError(err, '密钥无效')
      })
      .finally(() => this.setData({ verifying: false }))
  },

  onName(e: any) {
    this.setData({ name: e.detail.value || '' })
  },

  onStudentNo(e: any) {
    this.setData({ studentNo: e.detail.value || '' })
  },

  /** 定位并判断是否在围栏内 */
  locate() {
    if (this.data.locating) return
    this.setData({ locating: true })
    wx.getLocation({
      type: 'gcj02',
      success: (res: any) => {
        const lat = Math.round(res.latitude / GRID) * GRID
        const lng = Math.round(res.longitude / GRID) * GRID
        const s = this.data.session
        let distanceText = ''
        let inFence = false
        if (s) {
          const d = this.distanceM(lat, lng, s.lat, s.lng)
          distanceText = d >= 1000 ? `${(d / 1000).toFixed(1)} 公里` : `${Math.round(d)} 米`
          const poly = (s.polygon || []) as Array<Array<number>>
          // 有多边形边界就用它判定（与服务端同一套逻辑），否则退回圆形
          inFence = poly.length >= 3
            ? this.pointInPolygon(lat, lng, poly)
            : d <= s.radiusM
        }
        this.setData({
          located: true,
          locating: false,
          lat,
          lng,
          coordText: `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
          distanceText,
          inFence
        })
      },
      fail: () => {
        this.setData({ locating: false })
        toast('定位失败，请检查定位权限')
      }
    })
  },

  /** 射线法判断点是否在多边形内（polygon 为 [[lng, lat], ...]），与服务端一致 */
  pointInPolygon(lat: number, lng: number, polygon: Array<Array<number>>): boolean {
    const n = polygon.length
    if (n < 3) return false
    let inside = false
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = Number(polygon[i][0]); const yi = Number(polygon[i][1])
      const xj = Number(polygon[j][0]); const yj = Number(polygon[j][1])
      if ((yi > lat) !== (yj > lat)) {
        const xCross = ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi
        if (lng < xCross) inside = !inside
      }
    }
    return inside
  },

  /** 两点间距离（米） */
  distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const r = 6371000
    const rad = Math.PI / 180
    const p1 = lat1 * rad
    const p2 = lat2 * rad
    const dp = (lat2 - lat1) * rad
    const dl = (lng2 - lng1) * rad
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
    return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)))
  },

  onSubmit() {
    if (this.data.submitting) return
    const s = this.data.session
    if (!s) {
      toast('请先填写并验证签到密钥')
      return
    }
    const name = (this.data.name || '').trim()
    const studentNo = (this.data.studentNo || '').trim()
    if (!name) {
      toast('请填写姓名')
      return
    }
    if (!studentNo) {
      toast('请填写学号')
      return
    }
    if (!this.data.located) {
      toast('请先获取当前位置')
      return
    }
    if (!this.data.inFence) {
      toast('你不在签到范围内')
      return
    }
    this.setData({ submitting: true })
    contentApi.checkin({
      name,
      studentNo,
      lat: this.data.lat,
      lng: this.data.lng,
      checkinAt: nowISO(),
      sessionKey: s.key
    })
      .then((res: any) => this.setData({ result: res || {} }))
      .catch((err) => showError(err, '签到失败'))
      .finally(() => this.setData({ submitting: false }))
  },

  // ===================== 名单（组织者） =====================

  /** 点开我发起的某场签到：看密钥和二维码 */
  openDetail(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const item = (this.data.mySessions || []).filter((x: any) => x.sessionId === id)[0]
    if (!item) return
    // 已结束的签到：密钥与二维码已作废，不再展示
    if (item.status !== 'active') {
      toast('签到已结束，密钥和二维码已作废')
      return
    }
    this.setData({
      mode: 'detail',
      detailSession: item,
      qrUrl: `${BASE_URL}/checkin-sessions/${id}/qrcode`
    })
  },

  copyDetailKey() {
    const s = this.data.detailSession
    if (!s || !s.key) return
    wx.setClipboardData({ data: s.key, success: () => toast('密钥已复制') })
  },

  openRecords(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    this.setData({ mode: 'records', recordsLoading: true, records: null })
    contentApi.checkinSessionRecords(id)
      .then((res) => this.setData({ records: res || {} }))
      .catch((err) => {
        this.setData({ records: null })
        showError(err, '名单加载失败')
      })
      .finally(() => this.setData({ recordsLoading: false }))
  },

  closeSession(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '结束签到',
      content: '结束后密钥失效，其他人不能再签到。确定吗？',
      confirmText: '结束',
      success: (res) => {
        if (!res.confirm) return
        contentApi.closeCheckinSession(id)
          .then(() => {
            toast('已结束')
            this.loadMine()
            if (this.data.records && this.data.records.sessionId === id) {
              this.setData({ 'records.status': 'closed' })
            }
          })
          .catch((err) => showError(err, '操作失败'))
      }
    })
  },

  /** 复制名单为文本，方便组织者留存 */
  copyRecords() {
    const r = this.data.records
    if (!r || !r.list || !r.list.length) {
      toast('还没有人签到')
      return
    }
    const lines = r.list.map((x: any, i: number) =>
      `${i + 1}. ${x.name}\t${x.studentNo}\t${x.date}`)
    const text = `【${r.name}】${r.placeName}\n共 ${r.checkinCount} 人\n` + lines.join('\n')
    wx.setClipboardData({ data: text, success: () => toast('名单已复制') })
  },

  noop() {}
})
