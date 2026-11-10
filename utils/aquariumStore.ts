/**
 * 潮池住客的本地存储。
 *
 * 图片本体不存本地：抠好的 PNG 会传到后端 /uploads，这里只存返回的 URL。
 * 小程序临时文件路径会过期，不能直接存 wx.chooseMedia 的 tempFilePath。
 */

export type ResidentKind = 'fish' | 'crab' | 'snail' | 'jelly'

export type AquariumResident = {
  id: string
  name: string
  kind: ResidentKind
  /** 后端 /uploads/{id}/content 拼出来的可访问 URL，或示例鱼的 CDN 地址 */
  src: string
  /** 高 / 宽，用来给潮池里的图片算高度 */
  aspect: number
  /** 贴纸在预览里被水平翻转过：潮池游动时要把基础朝向反过来 */
  baseFlip: boolean
  createdAt: number
}

const STORAGE_KEY = 'aquariumResidentsV1'
const SEEDED_KEY = 'aquariumSeededV1'

/** 第一次进潮池时放一条示例鱼，避免空缸 */
const DEMO_SRC = '/assets/aquarium/demo-fish.png'

function normalizeKind(kind: any): ResidentKind {
  return kind === 'crab' || kind === 'snail' || kind === 'jelly' ? kind : 'fish'
}

function normalize(raw: any): AquariumResident | null {
  if (!raw || !raw.id || !raw.src) return null
  return {
    id: String(raw.id),
    name: String(raw.name || '小生物'),
    kind: normalizeKind(raw.kind),
    src: String(raw.src),
    aspect: Number(raw.aspect) > 0 ? Number(raw.aspect) : 1,
    baseFlip: !!raw.baseFlip,
    createdAt: Number(raw.createdAt) || Date.now()
  }
}

export function getResidents(): AquariumResident[] {
  try {
    const saved = wx.getStorageSync(STORAGE_KEY)
    if (!Array.isArray(saved)) return []
    return saved.map(normalize).filter(Boolean) as AquariumResident[]
  } catch (e) {
    return []
  }
}

export function saveResidents(list: AquariumResident[]): void {
  try {
    wx.setStorageSync(STORAGE_KEY, list)
  } catch (e) {
    // 本地存储失败不影响当前页面渲染
  }
}

export function addResident(resident: AquariumResident): AquariumResident[] {
  const list = getResidents()
  list.push(resident)
  saveResidents(list)
  return list
}

export function clearResidents(): void {
  try {
    wx.removeStorageSync(STORAGE_KEY)
    // 清空后不再自动补示例鱼，否则用户永远清不干净
    wx.setStorageSync(SEEDED_KEY, true)
  } catch (e) {
    // ignore
  }
}

/** 没有住客且从没播种过时，返回一条示例鱼并落库 */
export function ensureDemoResident(): AquariumResident[] {
  const list = getResidents()
  if (list.length) return list
  try {
    if (wx.getStorageSync(SEEDED_KEY)) return []
  } catch (e) {
    // ignore
  }
  const demo: AquariumResident = {
    id: 'demo_fish',
    name: '泡泡鱼',
    kind: 'fish',
    src: DEMO_SRC,
    aspect: 220 / 360,
    baseFlip: false,
    createdAt: Date.now()
  }
  saveResidents([demo])
  try {
    wx.setStorageSync(SEEDED_KEY, true)
  } catch (e) {
    // ignore
  }
  return [demo]
}
