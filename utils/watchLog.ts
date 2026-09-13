const SESSION_KEY = 'watchSession'
const LOGS_KEY = 'watchLogs'

const MASCOTS = [
  'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-star.png',
  'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-heart.png',
  'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png',
  'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-map.png',
  'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-hero-mascot.png'
]

export type WatchSpecies = {
  name: string
  time: string
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

function buildSummary(record: WatchRecord): string {
  const count = record.species.length
  if (!count) {
    return `这次观潮从 ${record.startTime} 到 ${record.endTime}，一共 ${record.durationText}。还没有识别到生物，下次可以拍一张给小螃蟹认一认。`
  }
  const names = record.species.map((item) => item.name).join('、')
  return `这次观潮从 ${record.startTime} 到 ${record.endTime}，一共 ${record.durationText}。期间认出了 ${count} 种潮间带伙伴：${names}。`
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

export function addWatchSpecies(name: string, time: string): void {
  const session = getWatchSession()
  if (!session || !name) return
  const exists = session.species.some((item) => item.name === name)
  if (exists) return
  session.species = session.species.concat([{ name, time }])
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
    species: session.species || [],
    summary: '',
    mascot: MASCOTS[logs.length % MASCOTS.length]
  }
  record.summary = buildSummary(record)
  wx.setStorageSync(LOGS_KEY, [record].concat(logs))
  wx.removeStorageSync(SESSION_KEY)
  return record
}

export function fromApiRecord(item: any): WatchRecord | null {
  if (!item) return null
  const species = (item.species || []).map((row: any) => ({
    name: row.name || '',
    time: row.time || ''
  })).filter((row: WatchSpecies) => row.name)
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
    mascot: item.mascot || 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-star.png'
  }
  if (!record.id) return null
  if (!record.summary) record.summary = buildSummary(record)
  return record
}

export function listWatchGroups(extra: WatchRecord[] = []): WatchDayGroup[] {
  const local: WatchRecord[] = wx.getStorageSync(LOGS_KEY) || []

  const merged: WatchRecord[] = []
  const seen: Record<string, boolean> = {}
  extra.concat(local).forEach((item) => {
    if (!item || !item.id || seen[item.id]) return
    seen[item.id] = true
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
