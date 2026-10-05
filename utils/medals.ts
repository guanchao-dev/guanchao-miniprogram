/**
 * 勋章公共数据层：成就页 / 勋章墙 / 勋章详情三处共用，
 * 把稀有度配色、兜底图标、排序规则收在一处，避免三份实现各写一套导致展示不一致。
 */

const CDN = 'https://www.blueakaiwu.cn/api/v1/static/assets'

export const RARITY_STYLE: Record<string, { tag: string, tagColor: string, tagBg: string }> = {
  common: { tag: '普通', tagColor: '#5BA3E0', tagBg: '#D6EAF8' },
  rare: { tag: '稀有', tagColor: '#3CB88A', tagBg: '#D4F5E8' },
  epic: { tag: '史诗', tagColor: '#9B7EDE', tagBg: '#EDE4FF' },
  legendary: { tag: '传说', tagColor: '#C48A2A', tagBg: '#F6E7C2' },
  hidden: { tag: '锁定', tagColor: '#9AA3AF', tagBg: '#E8EDF2' }
}

/** 后端没下发图标时按顺序兜底，保证每枚勋章都有一张图 */
export const MEDAL_ICONS = [
  `${CDN}/badges/crab-cloud.png`,
  `${CDN}/badges/crab-map.png`,
  `${CDN}/badges/crab-helmet.png`,
  `${CDN}/badges/crab-chest.png`,
  `${CDN}/badges/crab-detective.png`,
  `${CDN}/badges/crab-hero.png`,
  `${CDN}/badges/crab-dig.png`,
  `${CDN}/badges/crab-heart.png`,
  `${CDN}/badges/crab-star.png`,
  `${CDN}/badges/crab-checklist.png`,
  `${CDN}/badges/crab-diamond.png`,
  `${CDN}/badges/crab-book.png`,
  `${CDN}/badges/crab-astronaut.png`,
  `${CDN}/badges/crab-search.png`,
  `${CDN}/badges/crab-clock.png`,
  `${CDN}/badges/crab-crown.png`
]

export const LOCK_ICON = `${CDN}/achieve/lock.png`

/** 成就页只陈列 8 枚（2 行 × 4 个），完整列表在勋章墙 */
export const MEDAL_LIMIT_ON_ACHIEVE = 8

export function decorateMedal(item: any, index: number) {
  const row = item || {}
  const style = RARITY_STYLE[row.rarity] || RARITY_STYLE.common
  const locked = !!row.locked
  return {
    id: row.id || '',
    title: row.title || '???',
    displayTitle: row.displayTitle || row.title || '???',
    tag: row.tag || style.tag,
    tagColor: style.tagColor,
    tagBg: style.tagBg,
    icon: row.icon || row.iconUrl || (locked ? LOCK_ICON : MEDAL_ICONS[index % MEDAL_ICONS.length]),
    locked,
    description: row.description || '',
    requirements: row.requirements || [],
    rewards: row.rewards || {}
  }
}

/** 已解锁的排在前面；稳定排序，不打乱后端给定顺序 */
export function sortMedals(list: any[]): any[] {
  const rows = list || []
  const unlocked: any[] = []
  const locked: any[] = []
  rows.forEach((item) => {
    if (item && item.locked) locked.push(item)
    else unlocked.push(item)
  })
  return unlocked.concat(locked)
}

/** 合并列表项与 /medals/{id} 详情，产出详情页统一字段 */
export function buildMedalDetail(medal: any, detail: any, index = 0) {
  const merged = decorateMedal(Object.assign({}, medal || {}, detail || {}), index)
  const rewards = merged.rewards || {}
  return Object.assign({}, merged, {
    displayTitle: (detail && (detail.displayTitle || detail.title)) || merged.displayTitle,
    description: (detail && detail.description) || merged.description,
    requirements: (merged.requirements || []).map((row: any) => (
      typeof row === 'string' ? { text: row, done: !merged.locked } : row
    )),
    starReward: rewards.star || 0,
    shellReward: rewards.shell || 1
  })
}