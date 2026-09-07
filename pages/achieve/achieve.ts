import { achieveApi } from '../../services/api'
import { isLoggedIn } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { flushUnlocks } from '../../utils/unlock'

const RARITY_STYLE: Record<string, { tag: string, tagColor: string, tagBg: string }> = {
  common: { tag: '普通', tagColor: '#5BA3E0', tagBg: '#D6EAF8' },
  rare: { tag: '稀有', tagColor: '#3CB88A', tagBg: '#D4F5E8' },
  epic: { tag: '史诗', tagColor: '#9B7EDE', tagBg: '#EDE4FF' },
  legendary: { tag: '传说', tagColor: '#C48A2A', tagBg: '#F6E7C2' },
  hidden: { tag: '锁定', tagColor: '#9AA3AF', tagBg: '#E8EDF2' }
}

const LOCAL_ICONS = [
  '/assets/badges/crab-cloud.png',
  '/assets/badges/crab-map.png',
  '/assets/badges/crab-helmet.png',
  '/assets/badges/crab-chest.png',
  '/assets/badges/crab-detective.png',
  '/assets/badges/crab-hero.png',
  '/assets/badges/crab-dig.png',
  '/assets/badges/crab-heart.png',
  '/assets/badges/crab-star.png',
  '/assets/badges/crab-checklist.png',
  '/assets/badges/crab-diamond.png',
  '/assets/badges/crab-book.png',
  '/assets/badges/crab-astronaut.png',
  '/assets/badges/crab-search.png',
  '/assets/badges/crab-clock.png',
  '/assets/badges/crab-crown.png'
]

function decorateMedal(item: any, index: number) {
  const rarity = item.rarity || 'common'
  const style = RARITY_STYLE[rarity] || RARITY_STYLE.common
  const locked = !!item.locked
  return {
    id: item.id,
    title: item.title || '???',
    tag: item.tag || style.tag,
    tagColor: style.tagColor,
    tagBg: style.tagBg,
    icon: item.iconUrl || (locked ? '/assets/achieve/lock.png' : LOCAL_ICONS[index % LOCAL_ICONS.length]),
    locked,
    description: item.description || '',
    requirements: item.requirements || [],
    rewards: item.rewards || {}
  }
}

Page({
  data: {
    score: 0,
    total: 320,
    percent: 0,
    unlockedCount: 0,
    medalTotal: 18,
    showMedalModal: false,
    selectedMedal: null,
    showSharePanel: false,
    shareText: '',
    shareCopyIndex: 0,
    medals: [],
    friends: []
  },

  onShow() {
    this.loadOverview()
    this.loadMedals()
    this.loadFriends()
    flushUnlocks(this)
  },

  openPendingMedal() {
    const app = getApp()
    const openId = app.globalData && app.globalData.openMedalId
    if (!openId) return
    app.globalData.openMedalId = ''
    const index = (this.data.medals || []).findIndex((item: any) => String(item.id) === String(openId))
    if (index >= 0) this.onMedal({ currentTarget: { dataset: { index } } })
  },

  openUnlocked(medal: any) {
    const list: any[] = this.data.medals || []
    const index = list.findIndex((item) => String(item.id) === String(medal && medal.id))
    if (index >= 0) {
      this.onMedal({ currentTarget: { dataset: { index } } })
      return
    }
    if (medal && medal.id) {
      this.setData({
        showMedalModal: true,
        selectedMedal: {
          id: medal.id,
          title: medal.title,
          displayTitle: medal.title,
          icon: medal.icon,
          description: medal.description,
          tag: '新解锁',
          tagBg: '#F6E7C2',
          tagColor: '#C48A2A',
          locked: false,
          requirements: [],
          starReward: 0,
          shellReward: 1
        }
      })
    }
  },

  loadOverview() {
    achieveApi.overview()
      .then((data) => {
        this.setData({
          score: data.score || 0,
          total: data.total || 320,
          percent: data.percent || 0,
          unlockedCount: data.unlockedCount || 0,
          medalTotal: data.medalTotal || 18
        })
      })
      .catch(() => {})
  },

  loadMedals() {
    achieveApi.medals()
      .then((data) => {
        const list = (data && (data.list || data)) || []
        this.setData({ medals: list.map(decorateMedal) })
        this.openPendingMedal()
      })
      .catch((err) => showError(err, '勋章加载失败'))
  },

  loadFriends() {
    if (!isLoggedIn()) return
    achieveApi.friends()
      .then((data) => {
        const list = (data && (data.list || data)) || []
        this.setData({
          friends: list.map((item: any) => ({
            name: item.nickname || item.name,
            level: `Lv.${item.level || 1}`,
            score: item.score || 0,
            avatar: item.avatarUrl || '/assets/badges/crab-cloud.png',
            me: !!item.me
          }))
        })
      })
      .catch(() => {})
  },

  onMedal(e: any) {
    const item = this.data.medals[e.currentTarget.dataset.index]
    if (!item) return
    achieveApi.medal(String(item.id))
      .then((detail) => {
        const merged = decorateMedal(Object.assign({}, item, detail), e.currentTarget.dataset.index)
        const requirements = (detail.requirements || []).map((row: any) => (
          typeof row === 'string' ? { text: row, done: !merged.locked } : row
        ))
        this.setData({
          showMedalModal: true,
          selectedMedal: Object.assign({}, merged, {
            displayTitle: detail.displayTitle || merged.title,
            description: detail.description || merged.description,
            requirements,
            starReward: (detail.rewards && detail.rewards.star) || 0,
            shellReward: (detail.rewards && detail.rewards.shell) || 1
          })
        })
      })
      .catch(() => {
        this.setData({
          showMedalModal: true,
          selectedMedal: Object.assign({}, item, {
            displayTitle: item.title,
            requirements: [],
            starReward: 0,
            shellReward: 1
          })
        })
      })
  },

  closeMedal() {
    this.setData({ showMedalModal: false, showSharePanel: false })
  },

  getShareCopies() {
    const medal: any = this.data.selectedMedal
    const title = (medal && (medal.displayTitle || medal.title)) || '观潮'
    return [
      `我在 #观潮 解锁了「${title}」成就！每一次探索都是荣耀的印记，你也来挑战吧！🌊✨`,
      `今天的海洋探索又有新收获：成功获得「${title}」勋章！一起去发现潮间带的秘密吧。🦀`
    ]
  },

  openSharePanel() {
    const medal: any = this.data.selectedMedal
    const copies = this.getShareCopies()
    this.setData({ showSharePanel: true, shareCopyIndex: 0, shareText: copies[0] })
    if (medal && medal.id) {
      achieveApi.shareMedal(String(medal.id)).then((data) => {
        if (data && data.copyText) this.setData({ shareText: data.copyText })
      }).catch(() => {})
    }
  },

  closeSharePanel() {
    this.setData({ showSharePanel: false })
  },

  refreshShareCopy() {
    const copies = this.getShareCopies()
    const nextIndex = (this.data.shareCopyIndex + 1) % copies.length
    this.setData({ shareCopyIndex: nextIndex, shareText: copies[nextIndex] })
  },

  copyShareText() {
    wx.setClipboardData({ data: this.data.shareText })
  },

  shareToExternal(e: any) {
    wx.setClipboardData({
      data: this.data.shareText,
      success: () => toast(`文案已复制，请打开${e.currentTarget.dataset.channel}分享`)
    })
  },

  noop() {},

  onShareAppMessage() {
    const medal: any = this.data.selectedMedal
    return {
      title: medal && !medal.locked ? `我获得了“${medal.title}”勋章！` : '来观潮一起探索海洋吧'
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  }
})
