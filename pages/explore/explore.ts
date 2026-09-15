import { TENCENT_MAP_KEY } from '../../config/env'
import { authApi, exploreApi } from '../../services/api'
import { getUser, requireLogin } from '../../utils/auth'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'
import { nowISO, showError, toast } from '../../utils/format'
import {
  DEFAULT_VENUE,
  exploreRatio,
  fogPolygons,
  pointToGridId,
  Venue
} from '../../utils/exploreGrid'

Page({
  rawPath: [] as Array<{ latitude: number, longitude: number }>,
  visited: [] as string[],
  locHandler: null as any,
  startedAt: '',

  data: {
    venue: DEFAULT_VENUE,
    latitude: DEFAULT_VENUE.center.latitude,
    longitude: DEFAULT_VENUE.center.longitude,
    scale: 16,
    exploring: false,
    polyline: [],
    polygons: [],
    percentText: '0%',
    statusText: '等待开始',
    result: {},
    shareTitle: '来追潮记一起探索潮间带',
    mapKey: TENCENT_MAP_KEY
  },

  onLoad(query: any) {
    const venueId = (query && (query.venueId || query.spotId)) || DEFAULT_VENUE.venueId
    this.loadVenue(venueId)
  },

  onShow() {
    flushUnlocks(this)
  },

  onHide() {
    if (this.data.exploring) this.stopLocate()
  },

  onUnload() {
    this.clearPath()
    this.stopLocate()
  },

  loadVenue(venueId: string) {
    exploreApi.venue(venueId)
      .then((data) => this.applyVenue(Object.assign({ venueId }, data)))
      .catch(() => this.applyVenue(Object.assign({}, DEFAULT_VENUE, { venueId })))
  },

  applyVenue(venue: Venue) {
    const next = Object.assign({}, DEFAULT_VENUE, venue)
    this.setData({
      venue: next,
      latitude: next.center.latitude,
      longitude: next.center.longitude,
      scale: next.scale || 16
    })
    this.refreshFog()
  },

  refreshFog() {
    const venue: Venue = this.data.venue
    const polygons = fogPolygons(venue.venueId, venue.bbox, venue.gridSizeM, this.visited)
    const ratio = exploreRatio(venue.venueId, venue.bbox, venue.gridSizeM, this.visited)
    this.setData({
      polygons,
      percentText: `${Math.round(ratio * 100)}%`
    })
  },

  onStart() {
    if (!requireLogin()) return
    this.ensureParent().then((ok) => {
      if (!ok) return
      wx.showModal({
        title: '开始探索',
        content: '将在前台使用定位，路线只留在这台手机。结束时会删除经纬度，只上传经过的网格。',
        success: (res) => {
          if (!res.confirm) return
          this.beginSolo()
        }
      })
    })
  },

  ensureParent(): Promise<boolean> {
    const cached = getUser() || {}
    if (!cached.needGuardianConsent && !this.data.venue.needGuardian) {
      return Promise.resolve(true)
    }
    return authApi.me().then((me) => {
      if (me && me.needGuardianConsent) {
        toast('请家长先在设置里开启探索')
        wx.navigateTo({ url: '/pages/settings/settings' })
        return false
      }
      return true
    }).catch(() => true)
  },

  beginSolo() {
    this.rawPath = []
    this.visited = []
    this.startedAt = nowISO()
    this.setData({
      exploring: true,
      result: {},
      statusText: '探索中',
      polyline: []
    })
    this.refreshFog()
    this.locHandler = (res: any) => this.onLocate(res)
    wx.onLocationChange(this.locHandler)
    wx.startLocationUpdate({
      success: () => toast('已开始，在场地里走走吧'),
      fail: () => {
        wx.getLocation({
          type: 'gcj02',
          isHighAccuracy: true,
          success: (res: any) => this.onLocate(res),
          fail: (err: any) => {
            this.setData({ exploring: false, statusText: '定位未开启' })
            this.stopLocate()
            showError(err, '请允许定位后再探索')
          }
        })
      }
    })
  },

  onLocate(res: any) {
    if (!this.data.exploring || !res) return
    const latitude = Number(res.latitude)
    const longitude = Number(res.longitude)
    if (!latitude || !longitude) return
    const last = this.rawPath[this.rawPath.length - 1]
    if (last && Math.abs(last.latitude - latitude) < 0.00002 && Math.abs(last.longitude - longitude) < 0.00002) {
      return
    }
    this.rawPath.push({ latitude, longitude })
    const venue: Venue = this.data.venue
    const gridId = pointToGridId(venue.venueId, latitude, longitude, venue.bbox, venue.gridSizeM)
    if (gridId && this.visited.indexOf(gridId) < 0) this.visited.push(gridId)
    this.setData({
      latitude,
      longitude,
      polyline: [{
        points: this.rawPath.slice(),
        color: '#1878FF',
        width: 6,
        dottedLine: false
      }]
    })
    this.refreshFog()
  },

  stopLocate() {
    if (this.locHandler) {
      wx.offLocationChange(this.locHandler)
      this.locHandler = null
    }
    try { wx.stopLocationUpdate({}) } catch (e) {}
  },

  clearPath() {
    this.rawPath = []
    this.setData({ polyline: [] })
  },

  onStop() {
    if (!this.data.exploring) return
    this.stopLocate()
    const venue: Venue = this.data.venue
    const gridIds = this.visited.slice()
    const ratio = exploreRatio(venue.venueId, venue.bbox, venue.gridSizeM, gridIds)
    const startedAt = this.startedAt
    const endedAt = nowISO()
    this.clearPath()
    this.setData({ exploring: false, statusText: '正在上传网格' })
    exploreApi.submit({
      venueId: venue.venueId,
      mode: 'solo',
      gridIds,
      startedAt,
      endedAt,
      exploreRatio: Number(ratio.toFixed(4))
    })
      .then((result) => this.afterSubmit(result, ratio))
      .catch(() => this.afterSubmit({
        sessionId: `local_${Date.now()}`,
        venueName: venue.name,
        exploreRatio: ratio,
        badgeTitle: ratio >= 0.3 ? '潮间带漫步' : '潮间带初探'
      }, ratio))
  },

  afterSubmit(result: any, ratio: number) {
    enqueueUnlocks((result && result.unlockedMedalIds) || [], 'checkin')
    this.setData({
      result: result || {},
      percentText: `${Math.round(((result && result.exploreRatio) || ratio) * 100)}%`,
      statusText: '已结束，路线已删除',
      shareTitle: `我在${(result && result.venueName) || this.data.venue.name}探索了 ${Math.round((((result && result.exploreRatio) || ratio) * 100))}%`
    })
    flushUnlocks(this)
    toast('只上传了网格，路线已清除')
  },

  onScan() {
    if (!requireLogin()) return
    wx.scanCode({
      onlyFromCamera: false,
      success: (res: any) => {
        const code = (res.result || '').trim()
        if (!code) {
          toast('没有读到活动码')
          return
        }
        exploreApi.qrUnlock(code)
          .then((data) => {
            const venue: Venue = this.data.venue
            const gridIds = data.gridIds || []
            this.visited = gridIds
            this.refreshFog()
            return exploreApi.submit({
              venueId: data.venueId || venue.venueId,
              mode: 'group',
              gridIds,
              startedAt: nowISO(),
              endedAt: nowISO(),
              exploreRatio: data.exploreRatio
            }).catch(() => ({
              sessionId: `group_${Date.now()}`,
              venueName: venue.name,
              exploreRatio: data.exploreRatio || exploreRatio(venue.venueId, venue.bbox, venue.gridSizeM, gridIds),
              badgeTitle: data.badgeTitle || '团体探索'
            }))
          })
          .then((result) => this.afterSubmit(result, result.exploreRatio || 0))
          .catch((err) => showError(err, '活动码无效'))
      },
      fail: (err: any) => {
        if (String(err.errMsg || '').indexOf('cancel') >= 0) return
        showError(err, '扫码失败')
      }
    })
  },

  onShare() {
    const result: any = this.data.result
    if (result.sessionId && String(result.sessionId).indexOf('local_') < 0 && String(result.sessionId).indexOf('group_') < 0) {
      exploreApi.share(result.sessionId)
        .then((data) => {
          if (data && data.title) this.setData({ shareTitle: data.title })
          toast('分享卡不含路线，点右上角发给好友')
        })
        .catch(() => toast('点右上角发给好友，不会带上路线'))
      return
    }
    toast('点右上角发给好友，不会带上路线')
  },

  onShareAppMessage() {
    const venue: Venue = this.data.venue
    return {
      title: this.data.shareTitle,
      path: `/pages/explore/explore?venueId=${venue.venueId}`
    }
  }
})
