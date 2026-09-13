import { nowISO, showError, toast } from '../../utils/format'
import { lightMapApi } from '../../services/api'
import {
  LIGHT_MAPS,
  fetchLocation,
  getCurrentMapId,
  getLitIds,
  getMapById,
  matchRegions,
  saveCurrentMapId,
  saveLitIds
} from '../../utils/lightMap'

function unique(ids: string[]): string[] {
  const seen: Record<string, boolean> = {}
  return ids.filter((id) => {
    if (!id || seen[id]) return false
    seen[id] = true
    return true
  })
}

function withState(regions: any[], litIds: string[], clearingIds: string[]) {
  const litSet: Record<string, boolean> = {}
  litIds.forEach((id) => { litSet[id] = true })
  const clearingSet: Record<string, boolean> = {}
  clearingIds.forEach((id) => { clearingSet[id] = true })
  return regions.map((item) => {
    let state = 'fog'
    if (clearingSet[item.id]) state = 'clearing'
    else if (litSet[item.id]) state = 'cleared'
    return Object.assign({}, item, {
      lit: !!litSet[item.id] || !!clearingSet[item.id],
      state
    })
  })
}

// 区块（regions）只以接口为准，接口没返回就为空，不显示本地写死的假区块
function normalizeMap(raw: any) {
  const local = getMapById(raw && raw.id)
  return {
    id: (raw && raw.id) || local.id,
    name: (raw && raw.name) || local.name,
    // mapUrl 是本地 UI 底图资源，接口没给就用本地
    mapUrl: (raw && (raw.mapUrl || raw.coverUrl)) || local.mapUrl,
    regions: (raw && raw.regions) || []
  }
}

Page({
  timer: 0 as any,
  locHandler: null as any,
  locating: false,
  maps: LIGHT_MAPS as any[],

  data: {
    loading: true,
    mapId: LIGHT_MAPS[0].id,
    mapName: LIGHT_MAPS[0].name,
    mapUrl: LIGHT_MAPS[0].mapUrl,
    regions: []
  },

  onShow() {
    this.loadCatalog()
    this.probe()
    this.startLocate()
  },

  onHide() {
    this.stopLocate()
  },

  onUnload() {
    this.stopLocate()
    if (this.timer) clearTimeout(this.timer)
  },

  loadCatalog() {
    this.setData({ loading: true })
    lightMapApi.list()
      .then((list) => {
        this.maps = (list || []).map(normalizeMap)
        if (!this.maps.length) {
          this.applyMap(getMapById(getCurrentMapId()))
          return
        }
        const current = this.maps.filter((item: any) => item.id === getCurrentMapId())[0] || this.maps[0]
        this.loadMap(current.id)
      })
      .catch((err) => {
        this.applyMap(getMapById(getCurrentMapId()))
        showError(err, '地图加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  loadMap(id: string) {
    const local = this.maps.filter((item: any) => item.id === id)[0] || getMapById(id)
    this.applyMap(local)
    lightMapApi.detail(id)
      .then((data) => {
        if (!data) return
        const map = normalizeMap(data)
        this.maps = this.maps.map((item: any) => item.id === map.id ? map : item)
        const remoteLit = (map.regions || []).filter((row: any) => row.lit).map((row: any) => row.id)
        if (remoteLit.length) saveLitIds(map.id, unique(getLitIds(map.id).concat(remoteLit)))
        this.applyMap(map)
      })
      .catch(() => {})
    lightMapApi.progress(id)
      .then((data) => {
        const ids = (data && data.litRegionIds) || []
        if (!ids.length) return
        saveLitIds(id, unique(getLitIds(id).concat(ids)))
        const map = this.maps.filter((item: any) => item.id === id)[0] || getMapById(id)
        this.applyMap(map)
      })
      .catch(() => {})
  },

  applyMap(map: any) {
    const next = normalizeMap(map)
    this.setData({
      mapId: next.id,
      mapName: next.name,
      mapUrl: next.mapUrl,
      regions: withState(next.regions, getLitIds(next.id), [])
    })
    wx.setNavigationBarTitle({ title: next.name })
  },

  onSwitchMap() {
    const names = this.maps.map((item: any) => item.name)
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const map = this.maps[res.tapIndex]
        if (!map || map.id === this.data.mapId) return
        saveCurrentMapId(map.id)
        this.loadMap(map.id)
        this.probe()
      }
    })
  },

  startLocate() {
    if (this.locHandler) return
    this.locHandler = (res: any) => this.onLocate(res)
    wx.onLocationChange(this.locHandler)
    wx.startLocationUpdate({
      fail: () => {}
    })
  },

  stopLocate() {
    if (this.locHandler) {
      wx.offLocationChange(this.locHandler)
      this.locHandler = null
    }
    wx.stopLocationUpdate({ fail: () => {} })
  },

  probe() {
    if (this.locating) return
    this.locating = true
    fetchLocation()
      .then((pos) => this.lightAt(pos.lat, pos.lng))
      .catch(() => toast('需要定位才能点亮地图'))
      .then(() => { this.locating = false }, () => { this.locating = false })
  },

  onLocate(res: any) {
    if (!res) return
    const lat = Number(res.latitude)
    const lng = Number(res.longitude)
    if (!lat || !lng) return
    this.lightAt(lat, lng)
  },

  lightAt(lat: number, lng: number) {
    const map = this.maps.filter((item: any) => item.id === this.data.mapId)[0] || getMapById(this.data.mapId)
    const prevLit = getLitIds(map.id)
    const matched = matchRegions(lat, lng, map.regions).map((item: any) => item.id)
    const newly = matched.filter((id: string) => prevLit.indexOf(id) < 0)
    if (newly.length) {
      const nextLit = prevLit.concat(newly)
      saveLitIds(map.id, nextLit)
      this.setData({ regions: withState(map.regions, prevLit, newly) })
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        this.setData({ regions: withState(map.regions, nextLit, []) })
      }, 1200)
    } else {
      this.setData({ regions: withState(map.regions, prevLit, []) })
    }
    lightMapApi.visit(map.id, {
      latitude: lat,
      longitude: lng,
      clientTime: nowISO()
    }).then((data) => {
      const remoteNew = (data && data.newlyLitIds) || []
      const remoteAll = (data && data.litRegionIds) || []
      if (!remoteNew.length && !remoteAll.length) return
      const nextLit = unique(getLitIds(map.id).concat(remoteAll, remoteNew))
      const extra = remoteNew.filter((id: string) => prevLit.indexOf(id) < 0)
      saveLitIds(map.id, nextLit)
      if (!extra.length) {
        this.setData({ regions: withState(map.regions, nextLit, []) })
        return
      }
      this.setData({ regions: withState(map.regions, prevLit, extra) })
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        this.setData({ regions: withState(map.regions, nextLit, []) })
      }, 1200)
    }).catch(() => {})
  }
})
