import { getRegion, getRegionKey } from '../../utils/region'
import { enableShareMenu } from '../../utils/share'
import { getCachedLocation, GuideSpot, haversineM, loadGuideSpots, requestLocation } from '../../utils/spotGuide'

/** 地区默认地图中心（青岛 / 海南陵水），定位不可用时使用 */
const REGION_CENTER: Record<string, { latitude: number, longitude: number }> = {
  qingdao: { latitude: 36.0671, longitude: 120.3826 },
  hainan: { latitude: 18.5074, longitude: 110.0336 }
}

Page({
  mapCtx: null as any,
  markerSpots: [] as GuideSpot[],
  // 从首页「赶海地图自己选」进来时，直接进入拖动选点模式
  autoPick: false,

  data: {
    latitude: 36.0671,
    longitude: 120.3826,
    scale: 11,
    satellite: false,
    markers: [] as any[],
    circles: [] as any[],
    spotCount: 0,
    regionLabel: '',
    loading: true,
    locating: false,
    picking: false,
    pickSpot: null as any,
    pickDistanceText: '',
    pickFarText: ''
  },

  onLoad(options: any) {
    enableShareMenu()
    this.autoPick = String((options && options.pick) || '') === '1'
    const center = REGION_CENTER[getRegionKey()] || REGION_CENTER.qingdao
    const cached = getCachedLocation()
    this.setData({
      regionLabel: getRegion().label,
      latitude: cached ? cached.lat : center.latitude,
      longitude: cached ? cached.lng : center.longitude,
      scale: cached ? 13 : 11,
      picking: this.autoPick
    })
    this.loadSpots()
  },

  onReady() {
    this.mapCtx = wx.createMapContext('spotMap', this)
    if (this.autoPick) {
      // 等地图首帧渲染完再取中心点，避免拿到默认中心
      setTimeout(() => this.syncPickCenter(), 300)
    } else if (this.markerSpots.length) {
      this.fitPoints()
    }
  },

  onShareAppMessage() {
    return { title: '追潮记 · 赶海地图', path: '/pages/spot-map/spot-map' }
  },

  /** 拉取当前地区全部点位并铺到地图上（静默，不主动弹定位授权；定位由「定位」键触发） */
  loadSpots() {
    this.setData({ loading: true })
    loadGuideSpots(true)
      .then((list) => {
        const valid = (list || []).filter((spot) => spot.latitude && spot.longitude)
        this.markerSpots = valid
        const markers = valid.map((spot, index) => ({
          id: index,
          latitude: spot.latitude,
          longitude: spot.longitude,
          iconPath: '/assets/home/home-pin.png',
          width: 32,
          height: 38,
          callout: {
            content: spot.name,
            color: '#1C1C1C',
            fontSize: 12,
            borderRadius: 8,
            padding: 6,
            bgColor: '#FFFFFF',
            display: 'BYCLICK'
          }
        }))
        // 每个点位画一个半透明范围圈，提示这一带可以下水/赶海
        const circles = valid.map((spot) => ({
          latitude: spot.latitude,
          longitude: spot.longitude,
          radius: 500,
          fillColor: '#34B8C522',
          color: '#34B8C566',
          strokeWidth: 1
        }))
        this.setData({
          markers,
          circles,
          spotCount: markers.length,
          loading: false
        }, () => {
          // 选点模式下保持当前中心，不把视野缩到全部点位
          if (this.autoPick) this.syncPickCenter()
          else this.fitPoints()
        })
      })
      .catch(() => this.setData({ loading: false }))
  },

  /** 把全部点位收进可视区域 */
  fitPoints() {
    if (!this.mapCtx || !this.markerSpots.length) return
    if (this.markerSpots.length === 1) {
      const only = this.markerSpots[0]
      this.setData({ latitude: only.latitude, longitude: only.longitude, scale: 14 })
      return
    }
    this.mapCtx.includePoints({
      points: this.markerSpots.map((spot) => ({
        latitude: spot.latitude,
        longitude: spot.longitude
      })),
      padding: [80, 60, 140, 60]
    })
  },

  /** 普通地图 / 卫星地图切换 */
  toggleSatellite() {
    this.setData({ satellite: !this.data.satellite })
  },

  /** 一键回到当前位置 */
  locate() {
    if (this.data.locating) return
    this.setData({ locating: true })
    requestLocation(true)
      .then((loc) => {
        if (!loc) {
          wx.showToast({ title: '定位失败，请检查位置权限', icon: 'none' })
          return
        }
        this.setData({ latitude: loc.lat, longitude: loc.lng, scale: 14 })
        if (this.mapCtx) {
          this.mapCtx.moveToLocation({ latitude: loc.lat, longitude: loc.lng })
        }
      })
      .finally(() => this.setData({ locating: false }))
  },

  /** 点击点位标记：直接进入该点位的潮汐表 */
  onMarkerTap(e: any) {
    const markerId = Number(e && e.detail && e.detail.markerId)
    const spot = this.markerSpots[markerId]
    if (!spot) return
    wx.navigateTo({ url: `/pages/tide/tide?spotId=${spot.id}` })
  },

  /** 进入/退出地图拖动选点模式 */
  togglePick() {
    const picking = !this.data.picking
    this.setData({
      picking,
      pickSpot: null,
      pickDistanceText: '',
      pickFarText: ''
    })
    if (picking) this.syncPickCenter()
  },

  onRegionChange(e: any) {
    if (!this.data.picking || !e) return
    // 不同基础库把阶段放在 e.type 或 e.detail.type，两种都兼容
    const end = e.type === 'end' || (e.detail && e.detail.type === 'end')
    if (!end) return
    this.syncPickCenter()
  },

  syncPickCenter() {
    if (!this.mapCtx) return
    this.mapCtx.getCenterLocation({
      success: (res: any) => this.resolvePick(res.latitude, res.longitude),
      fail: () => {}
    })
  },

  /**
   * 判断地图中心点是否在海边：没有海陆边界数据，用「离最近收录赶海点是否 5km 内」近似。
   */
  resolvePick(lat: number, lng: number) {
    const rows = this.markerSpots.filter((spot) => spot.latitude && spot.longitude)
    if (!rows.length) {
      this.setData({ pickSpot: null, pickDistanceText: '', pickFarText: '当前地区还没有收录赶海点' })
      return
    }
    let best: GuideSpot | null = null
    let min = Infinity
    for (const spot of rows) {
      const d = haversineM(lat, lng, spot.latitude, spot.longitude)
      if (d < min) {
        min = d
        best = spot
      }
    }
    if (best && min <= 5000) {
      this.setData({
        pickSpot: best,
        pickDistanceText: this.fmtDistance(min),
        pickFarText: ''
      })
      return
    }
    this.setData({
      pickSpot: null,
      pickDistanceText: '',
      pickFarText: best ? `最近的「${best.name}」在 ${this.fmtDistance(min)} 外` : ''
    })
  },

  fmtDistance(meters: number): string {
    if (meters < 1000) return `${Math.round(meters)}m`
    return `${(meters / 1000).toFixed(1)}km`
  },

  goPickSpot() {
    const spot = this.data.pickSpot
    if (!spot) return
    wx.navigateTo({ url: `/pages/tide/tide?spotId=${spot.id}` })
  }
})
