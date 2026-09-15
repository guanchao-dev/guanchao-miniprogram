const SESSION_KEY = 'watchSession'
const LOGS_KEY = 'watchLogs'

const MASCOTS = [
  'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-star.png',
  'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-heart.png',
  'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png',
  'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-map.png',
  'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-hero-mascot.png'
]

export type WatchItemKind = 'species' | 'trash'

export type WatchSpecies = {
  name: string
  time: string
  /** 这条记录是生物还是垃圾。老数据没有这个字段，一律按 species 处理 */
  kind?: WatchItemKind
  speciesId?: string
  guessId?: string
  /** 仅垃圾：国标四分类的英文值与中文名 */
  category?: string
  categoryLabel?: string
  /** 这一条在照片里的位置描述（「左边礁石上的螃蟹」） */
  label?: string
  /** 同一物种 / 同类垃圾在照片里的个数 */
  count?: number
  /** 展示层 wx:key 用：`${kind}:${name}` */
  key?: string
}

/** 补齐 kind / count / key，让本地与服务端两条来源的记录形状一致。 */
function withKey(row: WatchSpecies): WatchSpecies {
  const kind: WatchItemKind = row.kind === 'trash' ? 'trash' : 'species'
  const count = Number(row.count) > 1 ? Number(row.count) : 1
  return { ...row, kind, count, key: `${kind}:${row.name}` }
}

export type WatchSession = {
  id?: string
  startedAt: string
  species: WatchSpecies[]
}

export type WatchRecord = {
  id: string
  date: string
  startedAt: string
  endedAt: string
  startTime: string
  endTime: string
  durationText: string
  species: WatchSpecies[]
  summary: string
  mascot: string
}

export type WatchDayGroup = {
  date: string
  label: string
  items: WatchRecord[]
}

/** 一次观潮里按类别分好的发现（生物 / 垃圾各一组） */
export type FindingGroup = {
  key: string
  title: string
  items: WatchSpecies[]
}

/**
 * 把一次观潮的发现按类别分成「生物」和「垃圾」两组，**组内按时间排序**。
 *
 * 空组不返回（避免出现「捡到的垃圾（0）」这种空标题）。
 * 详情页按 groups 渲染，不要再直接用扁平的 species 列表——那样两类会混在一起。
 */
export function groupFindings(species: WatchSpecies[] = []): FindingGroup[] {
  const byTime = (a: WatchSpecies, b: WatchSpecies) => (a.time || '').localeCompare(b.time || '')
  const creatures = (species || [])
    .filter((s) => s && s.name && (s.kind || 'species') === 'species')
    .sort(byTime)
  const trash = (species || []).filter((s) => s && s.name && s.kind === 'trash').sort(byTime)
  const groups: FindingGroup[] = []
  if (creatures.length) groups.push({ key: 'species', title: '认出的生物', items: creatures })
  if (trash.length) groups.push({ key: 'trash', title: '捡到的垃圾', items: trash })
  return groups
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseISO(value: string): Date {
  const safe = (value || '').replace('+08:00', '')
  const d = new Date(safe)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function timeText(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function durationText(start: Date, end: Date): string {
  const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

function dateLabel(date: string): string {
  const today = dateKey(new Date())
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (date === today) return '今天'
  if (date === dateKey(y)) return '昨天'
  const parts = date.split('-')
  return `${Number(parts[1])}月${Number(parts[2])}日`
}

/** 与后端 watch.py 的 _summary() 保持一致，避免本地/服务端两条记录的文案不一样。 */
function buildSummary(record: WatchRecord): string {
  const rows = (record.species || []).filter((s) => s && s.name)
  if (!rows.length) {
    return `这次观潮从 ${record.startTime} 到 ${record.endTime}，一共 ${record.durationText}。还没有识别到生物，下次可以拍一张给小螃蟹认一认。`
  }
  // 生物和垃圾分开说，别把塑料瓶也叫成「潮间带伙伴」
  const sp = rows.filter((s) => (s.kind || 'species') === 'species')
  const tr = rows.filter((s) => s.kind === 'trash')
  const parts: string[] = []
  if (sp.length) parts.push(`认出了 ${sp.length} 种潮间带伙伴：${sp.map((s) => s.name).join('、')}`)
  if (tr.length) parts.push(`还捡到 ${tr.length} 件垃圾：${tr.map((s) => s.name).join('、')}`)
  return `这次观潮从 ${record.startTime} 到 ${record.endTime}，一共 ${record.durationText}。${parts.join('；')}。`
}

export function getWatchSession(): WatchSession | null {
  return wx.getStorageSync(SESSION_KEY) || null
}

export function isWatching(): boolean {
  return !!getWatchSession()
}

export function startWatchSession(startedAt: string, serverId?: string): WatchSession {
  const session: WatchSession = { startedAt, species: [], id: serverId }
  wx.setStorageSync(SESSION_KEY, session)
  return session
}

export function setWatchSessionId(id: string): void {
  const session = getWatchSession()
  if (!session || !id) return
  session.id = id
  wx.setStorageSync(SESSION_KEY, session)
}

/**
 * 往当前观潮里记一条发现（生物或垃圾）。
 *
 * 去重按 kind+name：同名的生物和垃圾各记一条；重复确认同一条只记一次。
 * 注意这里必须把 kind/category 等字段一并存进本地缓存——结束观潮时
 * 上报给服务端的正是这条本地记录，只存 name/time 的话字段会在那一步丢掉。
 */
export function addWatchItem(item: WatchSpecies): void {
  const session = getWatchSession()
  if (!session || !item || !item.name) return
  const row = withKey(item)
  const exists = (session.species || []).some(
    (x) => (x.key || `${x.kind || 'species'}:${x.name}`) === row.key
  )
  if (exists) return
  session.species = (session.species || []).concat([row])
  wx.setStorageSync(SESSION_KEY, session)
}

export function endWatchSession(endedAt: string): WatchRecord | null {
  const session = getWatchSession()
  if (!session) return null
  const start = parseISO(session.startedAt)
  const end = parseISO(endedAt)
  const logs: WatchRecord[] = wx.getStorageSync(LOGS_KEY) || []
  const record: WatchRecord = {
    id: `watch_${Date.now()}`,
    date: dateKey(start),
    startedAt: session.startedAt,
    endedAt,
    startTime: timeText(start),
    endTime: timeText(end),
    durationText: durationText(start, end),
    species: (session.species || []).map(withKey),
    summary: '',
    mascot: MASCOTS[logs.length % MASCOTS.length]
  }
  record.summary = buildSummary(record)
  wx.setStorageSync(LOGS_KEY, [record].concat(logs))
  wx.removeStorageSync(SESSION_KEY)
  return record
}

/**
 * 删除本地某条观潮记录。
 * 服务端已经记下这次观潮时，把本地那条删掉，避免同一场观潮重复显示。
 */
export function removeWatchRecord(id: string): void {
  if (!id) return
  const logs: WatchRecord[] = wx.getStorageSync(LOGS_KEY) || []
  const next = logs.filter((item) => item && item.id !== id)
  if (next.length !== logs.length) wx.setStorageSync(LOGS_KEY, next)
}

export function fromApiRecord(item: any): WatchRecord | null {
  if (!item) return null
  // 必须把 kind/category 等字段透传过来，否则垃圾会被当成生物渲染
  const species = (item.species || [])
    .map((row: any) =>
      withKey({
        name: row.name || '',
        time: row.time || '',
        kind: row.kind === 'trash' ? 'trash' : 'species',
        speciesId: row.speciesId || '',
        guessId: row.guessId || '',
        category: row.category || '',
        categoryLabel: row.categoryLabel || '',
        label: row.label || '',
        count: Number(row.count) > 1 ? Number(row.count) : 1
      })
    )
    .filter((row: WatchSpecies) => row.name)
  const record: WatchRecord = {
    id: String(item.id || ''),
    date: item.date || (item.startedAt || '').slice(0, 10),
    startedAt: item.startedAt || '',
    endedAt: item.endedAt || '',
    startTime: item.startTime || '',
    endTime: item.endTime || '',
    durationText: item.durationText || '',
    species,
    summary: item.summary || '',
    // 后端字段名是 mascotKey，不是 mascot——之前只读 mascot，导致服务端记录永远显示默认图
    mascot: item.mascotKey || item.mascot || 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-star.png'
  }
  if (!record.id) return null
  if (!record.summary) record.summary = buildSummary(record)
  return record
}

export function listWatchGroups(extra: WatchRecord[] = []): WatchDayGroup[] {
  const local: WatchRecord[] = wx.getStorageSync(LOGS_KEY) || []

  // 同一次观潮可能同时存在「本地那条」和「服务端那条」（id 不同但 startedAt 相同），
  // 这里按 startedAt 去重，避免一次观潮显示成两条。服务端的优先（extra 在前）。
  const merged: WatchRecord[] = []
  const seen: Record<string, boolean> = {}
  extra.concat(local).forEach((item) => {
    if (!item || !item.id) return
    const key = item.startedAt || item.id
    if (seen[key]) return
    seen[key] = true
    merged.push(item)
  })
  const map: Record<string, WatchRecord[]> = {}
  merged.forEach((item) => {
    const key = item.date
    if (!map[key]) map[key] = []
    map[key].push(item)
  })
  return Object.keys(map)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => ({
      date,
      label: dateLabel(date),
      items: map[date]
    }))
}
