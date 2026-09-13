import { contentApi } from '../services/api'

export type GuideSpecies = {
  name: string
  id?: string
}

export type GuideSpot = {
  id: string
  name: string
  city: string
  heat: number
  latitude: number
  longitude: number
  coverUrl: string
  icon: string
  photos: string[]
  openTime: string
  observeHint: string
  safetyTags: string[]
  species: GuideSpecies[]
  distanceM?: number
  distanceText: string
}

const CITY = '青岛'


function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function formatDistance(m?: number): string {
  const n = Number(m)
  if (!n && n !== 0) return '距离待测'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}km`
  return `${Math.round(n)}m`
}

function cityName(name: string): string {
  return String(name || '').replace(/^青岛\s*[·•]\s*/, '').trim()
}

function photosOf(item: any, fallback: string[]): string[] {
  const raw = item.photos || item.panoramaUrls || item.imageUrls || item.covers
  const list = Array.isArray(raw) ? raw.filter(Boolean) : []
  if (item.coverUrl && list.indexOf(item.coverUrl) < 0) list.unshift(item.coverUrl)
  return list.length ? list : fallback.slice()
}

function speciesOf(item: any, fallback: GuideSpecies[]): GuideSpecies[] {
  const raw = item.speciesList || item.species || item.commonSpecies
  if (!Array.isArray(raw) || !raw.length) return fallback.slice()
  return raw.map((row: any) => {
    if (typeof row === 'string') return { name: row }
    return {
      name: row.name || row.title || '潮间带生物',
      id: row.id || row.speciesId
    }
  }).filter((row: GuideSpecies) => row.name)
}

/**
 * 只以接口数据为准（不再合并本地写死的 CATALOG 假数据）。
 * 接口没返回就是空列表，页面显示转圈 / 空态，不显示占位内容。
 */
export function mergeGuideSpots(apiList: any[], loc?: { lat: number; lng: number } | null): GuideSpot[] {
  const map: Record<string, GuideSpot> = {}
  ;(apiList || []).forEach((item: any) => {
    if (!item || !item.id) return
    const base = map[item.id] || {
      id: item.id,
      name: cityName(item.name) || '赶海点',
      city: item.city || CITY,
      heat: 50,
      latitude: Number(item.latitude || item.lat) || 0,
      longitude: Number(item.longitude || item.lng) || 0,
      coverUrl: '',
      icon: 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-nearby.png',
      photos: [],
      openTime: '以现场管理为准',
      observeHint: '',
      safetyTags: [],
      species: [],
      distanceText: ''
    }
    const lat = Number(item.latitude || item.lat)
    const lng = Number(item.longitude || item.lng)
    map[item.id] = Object.assign({}, base, {
      name: cityName(item.name) || base.name,
      city: item.city || base.city,
      heat: Number(item.heat || item.hotScore || item.visitCount) || base.heat,
      latitude: lat || base.latitude,
      longitude: lng || base.longitude,
      coverUrl: item.coverUrl || base.coverUrl,
      openTime: item.openTime || base.openTime,
      observeHint: item.observeHint || item.description || base.observeHint,
      safetyTags: (item.safetyTags && item.safetyTags.length) ? item.safetyTags : base.safetyTags,
      photos: photosOf(item, base.photos),
      species: speciesOf(item, base.species),
      distanceM: item.distanceM != null ? Number(item.distanceM) : base.distanceM
    })
  })

  return Object.keys(map).map((id) => {
    const spot = map[id]
    let distanceM = spot.distanceM
    if ((distanceM == null || Number.isNaN(distanceM)) && loc && spot.latitude && spot.longitude) {
      distanceM = haversineM(loc.lat, loc.lng, spot.latitude, spot.longitude)
    }
    return Object.assign({}, spot, {
      distanceM,
      distanceText: formatDistance(distanceM)
    })
  }).sort((a, b) => b.heat - a.heat)
}

export function nearestGuideSpot(list: GuideSpot[]): GuideSpot | null {
  const rows = list || []
  if (!rows.length) return null
  const withDist = rows
    .filter((item) => typeof item.distanceM === 'number' && !Number.isNaN(item.distanceM))
    .sort((a, b) => Number(a.distanceM) - Number(b.distanceM))
  return withDist[0] || rows.find((item) => item.id === 'spot_qd_shilaoren') || rows[0]
}

export function getCachedLocation(): { lat: number; lng: number } | null {
  const app = getApp()
  const lat = app.globalData && app.globalData.userLat
  const lng = app.globalData && app.globalData.userLng
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
  return null
}

export function requestLocation(): Promise<{ lat: number; lng: number } | null> {
  const cached = getCachedLocation()
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: (res: any) => {
        const loc = { lat: res.latitude, lng: res.longitude }
        const app = getApp()
        if (app.globalData) {
          app.globalData.userLat = loc.lat
          app.globalData.userLng = loc.lng
        }
        resolve(loc)
      },
      fail: () => resolve(null)
    })
  })
}

export function loadGuideSpots(): Promise<GuideSpot[]> {
  return requestLocation().then((loc) => {
    const params: Record<string, any> = { city: CITY, page: 1, pageSize: 50 }
    if (loc) {
      params.lat = loc.lat
      params.lng = loc.lng
    }
    return contentApi.spots(params)
      .then((res) => mergeGuideSpots(res.list || [], loc))
      .catch(() => mergeGuideSpots([], loc))
  })
}
