/**
 * 用户宝藏点位本地缓存（mock 兜底用）。
 * 后端 /spots/mine 接口未就绪时，所有上传/查询/删除走本地 storage；
 * 接口联调后此模块的兜底分支可移除（保留作为离线缓存可选）。
 */

const STORAGE_KEY = 'my_treasure_spots'

export interface TreasureSpot {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  note?: string
  photoUrl?: string
  createdAt: string
}

function genId(): string {
  return 'spot_local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

export function loadSpots(): TreasureSpot[] {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (!raw) return []
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    return []
  }
}

function save(list: TreasureSpot[]): void {
  try {
    wx.setStorageSync(STORAGE_KEY, list)
  } catch (e) {
    /* ignore */
  }
}

export function addSpot(payload: Omit<TreasureSpot, 'id' | 'createdAt'>): TreasureSpot {
  const spot: TreasureSpot = {
    id: genId(),
    createdAt: new Date().toISOString(),
    ...payload
  }
  const list = loadSpots()
  list.unshift(spot)
  save(list)
  return spot
}

export function removeSpot(id: string): void {
  const list = loadSpots().filter((item) => item.id !== id)
  save(list)
}
