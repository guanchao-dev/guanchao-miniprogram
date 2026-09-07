import { achieveApi } from '../services/api'
import { isLoggedIn } from './auth'
import { nowISO } from './format'

const LOCAL_ICONS = [
  '/assets/badges/crab-cloud.png',
  '/assets/badges/crab-map.png',
  '/assets/badges/crab-helmet.png',
  '/assets/badges/crab-chest.png',
  '/assets/badges/crab-star.png',
  '/assets/badges/crab-crown.png'
]

function queue(): any[] {
  const app = getApp()
  if (!app.globalData) app.globalData = {}
  if (!app.globalData.unlockQueue) app.globalData.unlockQueue = []
  return app.globalData.unlockQueue
}

function normalize(item: any, source = 'pending') {
  if (!item) return null
  if (typeof item === 'string') {
    return { medalId: item, id: item, source }
  }
  const id = item.medalId || item.id
  if (!id) return null
  return Object.assign({ source }, item, { medalId: id, id })
}

export function enqueueUnlocks(list: any[], source = 'other') {
  const q = queue()
  const seen: Record<string, boolean> = {}
  q.forEach((item: any) => { if (item && item.medalId) seen[item.medalId] = true })
  ;(list || []).forEach((item) => {
    const row = normalize(item, source)
    if (!row || seen[row.medalId]) return
    seen[row.medalId] = true
    q.push(row)
  })
}

export function takeUnlock() {
  return queue().shift() || null
}

export function resolveMedal(item: any): Promise<any> {
  const fallbackIcon = LOCAL_ICONS[Math.abs(String(item.medalId || '').length) % LOCAL_ICONS.length]
  if (item.title || item.displayTitle) {
    return Promise.resolve({
      id: item.medalId,
      title: item.displayTitle || item.title,
      description: item.description || '又留下一枚海洋足迹，继续去潮间带看看吧。',
      icon: item.iconUrl || item.icon || fallbackIcon,
      source: item.source || 'pending'
    })
  }
  return achieveApi.medal(item.medalId)
    .then((detail) => ({
      id: item.medalId,
      title: (detail && (detail.displayTitle || detail.title)) || '新徽章',
      description: (detail && detail.description) || '又留下一枚海洋足迹，继续去潮间带看看吧。',
      icon: (detail && detail.iconUrl) || fallbackIcon,
      source: item.source || 'pending'
    }))
    .catch(() => ({
      id: item.medalId,
      title: '新徽章',
      description: '又留下一枚海洋足迹，继续去潮间带看看吧。',
      icon: fallbackIcon,
      source: item.source || 'pending'
    }))
}

export function ackUnlock(medalId: string, source = 'pending') {
  if (!medalId || !isLoggedIn()) return Promise.resolve(null)
  return achieveApi.ackUnlock(medalId, source).catch(() => null)
}

export function pullPendingUnlocks() {
  if (!isLoggedIn()) return Promise.resolve()
  return achieveApi.pendingUnlocks()
    .then((data) => enqueueUnlocks((data && (data.list || data)) || [], 'pending'))
    .catch(() => {})
}

export function flushUnlocks(page: any) {
  if (!page || !page.selectComponent) return
  const comp = page.selectComponent('#unlockPopup')
  if (!comp || (comp.isShowing && comp.isShowing())) return
  const next = takeUnlock()
  if (next) {
    resolveMedal(next).then((medal) => comp.show(medal))
    return
  }
  pullPendingUnlocks().then(() => {
    const again = takeUnlock()
    if (!again) return
    resolveMedal(again).then((medal) => comp.show(medal))
  })
}

export { nowISO }
