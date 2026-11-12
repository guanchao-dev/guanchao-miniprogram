/**
 * 潮池住客：登录后以账号为准，本机存储只是缓存。
 *
 * 图片本体不存本地：抠好的 PNG 在对象存储（COS）里，这里只存访问 URL 和 object_key。
 * 未登录/网络失败时继续用本机缓存，保证潮池还能看。
 */
import http from './http'
import { mediaUrl } from './upload'

export type ResidentKind = 'fish' | 'crab' | 'snail' | 'jelly'

export type AquariumResident = {
  id: string
  name: string
  kind: ResidentKind
  /** 可访问的图片 URL（COS 直链或本机 /media 回退） */
  src: string
  /** 高 / 宽，用来给潮池里的图片算高度 */
  aspect: number
  /** 用户调节的显示大小，1 = 默认 */
  scale?: number
  /** 贴纸旋转角度 -180~180 */
  rotation?: number
  /** 贴纸在预览里被水平翻转过：潮池游动时要把基础朝向反过来 */
  baseFlip: boolean
  createdAt: number
  /** 对象存储里的 key；账号同步时用，老的本机数据可能没有 */
  objectKey?: string
  /** 本次新增物种奖励的代币（仅创建响应有，不落缓存） */
  coinsAwarded?: number
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
    scale: Number(raw.scale) > 0 ? Number(raw.scale) : 1,
    rotation: Number(raw.rotation) || 0,
    baseFlip: !!raw.baseFlip,
    createdAt: Number(raw.createdAt) || Date.now(),
    objectKey: raw.objectKey ? String(raw.objectKey) : undefined
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

// ===== 账号同步 =====

type ServerResident = {
  id: string
  name: string
  kind: string
  url: string
  objectKey?: string
  aspect?: number
  scale?: number
  rotation?: number
  coinsAwarded?: number
  baseFlip?: boolean
  createdAtMs?: number
}

function fromServer(raw: ServerResident): AquariumResident | null {
  if (!raw || !raw.id || !raw.url) return null
  return {
    id: String(raw.id),
    name: String(raw.name || '小生物'),
    kind: normalizeKind(raw.kind),
    src: mediaUrl(String(raw.url)),
    aspect: Number(raw.aspect) > 0 ? Number(raw.aspect) : 1,
    scale: Number(raw.scale) > 0 ? Number(raw.scale) : 1,
    rotation: Number(raw.rotation) || 0,
    baseFlip: !!raw.baseFlip,
    createdAt: Number(raw.createdAtMs) || Date.now(),
    objectKey: raw.objectKey ? String(raw.objectKey) : undefined,
    coinsAwarded: Number(raw.coinsAwarded) || 0
  }
}

/** 从 /uploads/{id}/content 里取出 uploadId（迁移本机老住客用） */
function uploadIdFromSrc(src: string): string {
  const m = String(src || '').match(/\/uploads\/([^/]+)\/content/)
  return m ? m[1] : ''
}

/** 老住客的 src 如果是 COS 直链或 /media 路径，直接还原 object_key */
function objectKeyFromSrc(src: string): string {
  const s = String(src || '')
  const cos = s.match(/^https?:\/\/[^/]+\/(private\/user_[^/]+\/.*)$/)
  if (cos) return cos[1]
  const media = s.match(/\/media\/(private\/user_.*)$/)
  return media ? media[1] : ''
}

export async function fetchResidents(): Promise<AquariumResident[]> {
  const data: any = await http.get('/aquarium/residents', {}, { cacheTtl: 0 })
  const items = (data && data.items) || []
  return (items as ServerResident[]).map(fromServer).filter(Boolean) as AquariumResident[]
}

export async function createResident(input: {
  name: string
  kind: ResidentKind
  objectKey?: string
  uploadId?: string
  sourceUploadId?: string
  speciesName?: string
  aspect: number
  scale?: number
  rotation?: number
  baseFlip: boolean
}): Promise<AquariumResident> {
  const data: any = await http.post('/aquarium/residents', input)
  const resident = fromServer(data as ServerResident)
  if (!resident) throw new Error('保存住客失败')
  return resident
}

export async function removeResidentRemote(id: string): Promise<void> {
  await http.delete(`/aquarium/residents/${id}`)
}

export async function clearResidentsRemote(): Promise<void> {
  await http.delete('/aquarium/residents')
}

/**
 * 登录后同步：服务端有数据就以服务端为准；服务端为空时，把本机旧住客迁上去一次。
 * 网络失败会抛出，调用方继续用本机缓存。
 */
export async function syncResidents(): Promise<AquariumResident[]> {
  const server = await fetchResidents()
  if (server.length) {
    saveResidents(server)
    return server
  }

  const local = getResidents().filter((r) => r.id !== 'demo_fish')
  if (!local.length) {
    saveResidents([])
    return []
  }

  const imported: AquariumResident[] = []
  for (const r of local) {
    try {
      const objectKey = r.objectKey || objectKeyFromSrc(r.src)
      const saved = await createResident({
        name: r.name,
        kind: r.kind,
        objectKey: objectKey || undefined,
        uploadId: objectKey ? undefined : uploadIdFromSrc(r.src),
        aspect: r.aspect,
        baseFlip: r.baseFlip
      })
      imported.push(saved)
    } catch (e) {
      // 单条迁移失败不阻断其它住客
    }
  }
  saveResidents(imported)
  return imported
}

// ===== 潮池外观设置（账号同步 + 本机缓存）=====

export type AquariumTheme = 'day' | 'night'

export type AquariumSettings = {
  theme: AquariumTheme
  landscape: boolean
  backgroundUrl: string
  backgroundKey: string
}

const PREFS_KEY = 'aquariumPrefsV1'

export function getLocalSettings(): AquariumSettings {
  try {
    const raw = wx.getStorageSync(PREFS_KEY)
    if (raw && typeof raw === 'object') {
      return {
        theme: raw.theme === 'night' ? 'night' : 'day',
        landscape: !!raw.landscape,
        backgroundUrl: String(raw.backgroundUrl || ''),
        backgroundKey: String(raw.backgroundKey || '')
      }
    }
  } catch (e) {
    // ignore
  }
  return { theme: 'day', landscape: false, backgroundUrl: '', backgroundKey: '' }
}

export function saveLocalSettings(patch: Partial<AquariumSettings>): void {
  const next = Object.assign(getLocalSettings(), patch)
  try {
    wx.setStorageSync(PREFS_KEY, next)
  } catch (e) {
    // ignore
  }
}

function mapSettings(raw: any): AquariumSettings {
  return {
    theme: raw && raw.theme === 'night' ? 'night' : 'day',
    landscape: !!(raw && raw.landscape),
    backgroundUrl: String((raw && raw.backgroundUrl) || ''),
    backgroundKey: String((raw && raw.backgroundKey) || '')
  }
}

export async function fetchSettings(): Promise<AquariumSettings> {
  const data: any = await http.get('/aquarium/settings', {}, { cacheTtl: 0 })
  return mapSettings(data)
}

export async function updateSettings(patch: {
  theme?: AquariumTheme
  landscape?: boolean
  backgroundKey?: string
}): Promise<AquariumSettings> {
  const data: any = await http.put('/aquarium/settings', patch)
  return mapSettings(data)
}

/** 上传自定义背景；后端审核通过才返回 backgroundUrl */
export async function uploadBackground(filePath: string): Promise<any> {
  return http.upload('/aquarium/background', filePath, {}, { timeout: 90000 })
}

/** 长按调整大小：本机缓存 + 服务端 */
export function setResidentScaleLocal(id: string, scale: number): void {
  const list = getResidents().map((r) => (r.id === id ? Object.assign({}, r, { scale }) : r))
  saveResidents(list)
}

export async function updateResidentScaleRemote(id: string, scale: number): Promise<void> {
  await http.put(`/aquarium/residents/${id}`, { scale })
}

/** 长按调整：大小 + 旋转，一起写本机和服务端 */
export function setResidentAdjustmentsLocal(id: string, scale: number, rotation: number): void {
  const list = getResidents().map((r) =>
    r.id === id ? Object.assign({}, r, { scale, rotation }) : r
  )
  saveResidents(list)
}

export async function updateResidentAdjustmentsRemote(
  id: string,
  scale: number,
  rotation: number
): Promise<void> {
  await http.put(`/aquarium/residents/${id}`, { scale, rotation })
}


/** 从本机缓存删除一只住客 */
export function removeResidentLocal(id: string): void {
  saveResidents(getResidents().filter((r) => r.id !== id))
}
