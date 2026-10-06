import { contentApi } from '../services/api'

export type GuideSpecies = {
  name: string
  id?: string
}

export type GuideSpot = {
  id: string
  name: string
  city: string
  /** 所属区，如「崂山区」「黄岛区」 */
  district?: string
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
  /** 导航目的地名称（如「红石崖赶海停车场」），缺省时用点位名 */
  navName?: string
}

export const CITY = '青岛'

/**
 * 内置兜底赶海点。后端已收录全部点位，这里不再内置任何条目 ——
 * 之前内置的红石崖 id 与后端对不上，会作为第二个「红石崖」重复追加，且坐标在海里。
 * 后端恢复收录时由接口返回，不需要前端兜底。
 */
const FALLBACK_SPOTS: GuideSpot[] = []


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
      district: item.district || base.district,
      heat: Number(item.heat || item.hotScore || item.visitCount) || base.heat,
      latitude: lat || base.latitude,
      longitude: lng || base.longitude,
      coverUrl: item.coverUrl || base.coverUrl,
      openTime: item.openTime || base.openTime,
      observeHint: item.observeHint || item.description || base.observeHint,
      safetyTags: (item.safetyTags && item.safetyTags.length) ? item.safetyTags : base.safetyTags,
      photos: photosOf(item, base.photos),
      species: speciesOf(item, base.species),
      distanceM: item.distanceM != null ? Number(item.distanceM) : base.distanceM,
      navName: item.navName || item.parkingName || base.navName
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

/**
 * 观潮选点推荐：距离与热度综合排序（复用赶海点推荐的同一套数据）。
 *
 * 打分口径：热度 0~100，距离每 1km 折抵 10 分，
 * 即 score = heat - distanceM / 100。有距离的点位排在无距离点位之前；
 * 定位失败全部无距离时退化为纯热度排序。
 */
export function rankWatchSpots(list: GuideSpot[], limit = 5): GuideSpot[] {
  const rows = (list || []).filter((s) => s && s.id && s.name)
  const scored = rows.map((s) => {
    const heat = Math.max(0, Math.min(100, Number(s.heat) || 0))
    const dist = typeof s.distanceM === 'number' && s.distanceM >= 0 ? s.distanceM : null
    return {
      spot: s,
      hasDist: dist !== null,
      score: dist === null ? heat * 0.5 : heat - dist / 100
    }
  })
  return scored
    .sort((a, b) => {
      if (a.hasDist !== b.hasDist) return a.hasDist ? -1 : 1
      return b.score - a.score
    })
    .slice(0, limit)
    .map((x) => x.spot)
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

/** force=true 时忽略缓存，强制调一次 wx.getLocation（用户点击定位时用它拉起授权弹窗） */
export function requestLocation(force = false): Promise<{ lat: number; lng: number } | null> {
  const cached = force ? null : getCachedLocation()
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

/**
 * 把内置默认点位并入接口结果：同 id 以后端为准，缺失的补到末尾，
 * 并统一补算距离。接口整体失败时只剩默认点位。
 */
export function withFallbackSpots(list: GuideSpot[], loc?: { lat: number; lng: number } | null): GuideSpot[] {
  const apiIds: Record<string, boolean> = {}
  ;(list || []).forEach((s) => { apiIds[s.id] = true })
  const extra = FALLBACK_SPOTS.filter((s) => !apiIds[s.id])
  return list
    .concat(extra)
    .map((spot) => {
      let distanceM = spot.distanceM
      if ((distanceM == null || Number.isNaN(distanceM)) && loc && spot.latitude && spot.longitude) {
        distanceM = haversineM(loc.lat, loc.lng, spot.latitude, spot.longitude)
      }
      return Object.assign({}, spot, { distanceM, distanceText: formatDistance(distanceM) })
    })
    .sort((a, b) => b.heat - a.heat)
}

/**
 * silent=true 时只用已缓存定位，不主动申请位置权限。
 * 用于页面加载场景（如首页推荐位），避免一进页面就弹出定位授权。
 */
export function loadGuideSpots(silent = false): Promise<GuideSpot[]> {
  const ready = silent ? Promise.resolve(getCachedLocation()) : requestLocation()
  return ready.then((loc) => {
    const params: Record<string, any> = { city: CITY, page: 1, pageSize: 50 }
    if (loc) {
      params.lat = loc.lat
      params.lng = loc.lng
    }
    return contentApi.spots(params)
      .then((res) => withFallbackSpots(mergeGuideSpots(res.list || [], loc), loc))
      .catch(() => withFallbackSpots(mergeGuideSpots([], loc), loc))
  })
}
