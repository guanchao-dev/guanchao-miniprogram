/**
 * 地区版本：青岛 / 海南。
 *
 * 后端 /spots、/home/today 的 city 只认「青岛 / 陵水 / 海口 / 三亚」这类城市简称，
 * 没有「海南」聚合值，所以前端用 Region 把多个城市打包成一个地区：
 * - 青岛：青岛市
 * - 海南：陵水、海口、三亚（点位合并展示、潮汐默认取热度最高的陵水）
 */
export type RegionKey = 'qingdao' | 'hainan'

export type Region = {
  key: RegionKey
  /** 顶部地址芯片展示的地区名 */
  label: string
  /** 请求后端时使用的城市简称 */
  cities: string[]
  /** 没有指定点位时，/home/today 使用的默认城市 */
  defaultCity: string
}

export const REGIONS: Record<RegionKey, Region> = {
  qingdao: {
    key: 'qingdao',
    label: '青岛',
    cities: ['青岛'],
    defaultCity: '青岛'
  },
  hainan: {
    key: 'hainan',
    label: '海南',
    cities: ['陵水', '海口', '三亚'],
    defaultCity: '陵水'
  }
}

const REGION_STORAGE_KEY = 'region_key'
const SPOT_STORAGE_PREFIX = 'region_spot_'

export function getRegionKey(): RegionKey {
  try {
    return wx.getStorageSync(REGION_STORAGE_KEY) === 'hainan' ? 'hainan' : 'qingdao'
  } catch (e) {
    return 'qingdao'
  }
}

export function getRegion(): Region {
  return REGIONS[getRegionKey()]
}

export function setRegionKey(key: RegionKey): void {
  try {
    wx.setStorageSync(REGION_STORAGE_KEY, REGIONS[key] ? key : 'qingdao')
  } catch (e) {}
}

/** 后端城市名 → 所属地区；未收录的城市返回 null */
export function regionKeyOfCity(city?: string): RegionKey | null {
  const name = String(city || '').trim()
  if (!name) return null
  if (REGIONS.hainan.cities.indexOf(name) >= 0) return 'hainan'
  if (REGIONS.qingdao.cities.indexOf(name) >= 0) return 'qingdao'
  return null
}

/** 每个地区各记一个默认点位，来回切换时不会串 */
export function getSavedSpotId(): string {
  try {
    return String(wx.getStorageSync(SPOT_STORAGE_PREFIX + getRegionKey()) || '')
  } catch (e) {
    return ''
  }
}

export function saveSpotId(id: string): void {
  if (!id) return
  try {
    wx.setStorageSync(SPOT_STORAGE_PREFIX + getRegionKey(), id)
  } catch (e) {}
}
