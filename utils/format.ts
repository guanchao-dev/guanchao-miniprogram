function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function nowISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+08:00`
}

export function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function nowTime(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function toISO(date: string, time: string): string {
  const hm = time.length === 5 ? `${time}:00` : time
  return `${date}T${hm}+08:00`
}

export function pick(obj: any, ...keys: string[]): any {
  if (!obj) return undefined
  for (let i = 0; i < keys.length; i++) {
    if (obj[keys[i]] != null && obj[keys[i]] !== '') return obj[keys[i]]
  }
  return undefined
}

export function trendText(trend?: string): string {
  const map: Record<string, string> = {
    rising: '涨潮中',
    falling: '退潮中',
    high: '高潮',
    low: '低潮',
    unknown: '潮汐变化中'
  }
  return map[trend || ''] || '潮汐变化中'
}

export function rarityText(rarity?: string): string {
  const map: Record<string, string> = {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
    hidden: '锁定'
  }
  return map[rarity || ''] || '普通'
}

export function toast(title: string): void {
  wx.showToast({ title: title.slice(0, 18), icon: 'none' })
}

export function showError(err: any, fallback = '请求失败'): void {
  const message = (err && err.message) || fallback
  toast(message)
}
