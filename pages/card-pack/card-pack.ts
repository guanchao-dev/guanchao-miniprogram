import http from '../../utils/http'
import { requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'

const CATEGORY_NAMES: Record<string, string> = {
  physical: '物理海洋',
  tech: '海洋科技',
  other_marine: '其他海洋生物'
}

Page({
  data: {
    loading: true,
    drawing: false,
    opening: false,
    coins: 0,
    canDraw: false,
    cost: 100,
    cards: [] as any[],
    revealedCount: 0,
    drew: false,
    remaining: null as number | null
  },

  _revealTimers: [] as any[],

  onShow() {
    this.loadWallet()
  },

  onUnload() {
    this._revealTimers.forEach((t: any) => clearTimeout(t))
    this._revealTimers = []
  },

  loadWallet() {
    this.setData({ loading: true })
    http.get('/wallet', {}, { cacheTtl: 0 })
      .then((data: any) => {
        const coins = Number(data && data.coins) || 0
        this.setData({ coins, canDraw: coins >= this.data.cost })
      })
      .catch(() => {
        // 未登录时显示 0，点抽卡会去登录
        this.setData({ coins: 0, canDraw: false })
      })
      .finally(() => this.setData({ loading: false }))
  },

  onDraw() {
    if (this.data.drawing) return
    if (!requireLogin()) return
    if (this.data.coins < this.data.cost) {
      toast('代币不够，去潮池收集新生物')
      return
    }
    this._revealTimers.forEach((t: any) => clearTimeout(t))
    this._revealTimers = []
    this.setData({ drawing: true, opening: true, drew: false, cards: [], revealedCount: 0 })
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })

    const started = Date.now()
    http.post('/gacha/draw', {}, { timeout: 20000 })
      .then((data: any) => {
        const cards = (data.cards || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          categoryName: CATEGORY_NAMES[c.category] || '海洋图鉴',
          summary: c.summary || '',
          coverUrl: c.coverUrl || ''
        }))
        const coins = Number(data.coins) || 0
        // 至少让卡包动画播 750ms，接口太快时也不会一闪而过
        const wait = Math.max(0, 750 - (Date.now() - started))
        setTimeout(() => {
          this.setData({
            opening: false,
            drawing: false,
            coins,
            canDraw: coins >= this.data.cost,
            cards,
            revealedCount: 0,
            drew: true,
            remaining: data.remaining === undefined ? null : data.remaining
          })
          // 卡片先背面朝上，然后一张一张翻开
          cards.forEach((_: any, i: number) => {
            const t = setTimeout(() => {
              this.setData({ revealedCount: i + 1 })
              if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
            }, 320 + i * 650)
            this._revealTimers.push(t)
          })
        }, wait)
      })
      .catch((err) => {
        this.setData({ opening: false, drawing: false })
        showError(err, '抽卡失败')
      })
  },

  onOpenCard(e: any) {
    const index = Number((e.currentTarget.dataset.index) || 0)
    if (index >= this.data.revealedCount) return
    const id = String((e.currentTarget.dataset.id) || '')
    if (!id) return
    wx.navigateTo({ url: '/pages/wiki-detail/wiki-detail?id=' + encodeURIComponent(id) })
  },

  onGoWiki() {
    const pages = getCurrentPages()
    const prev = pages[pages.length - 2]
    if (prev && (prev as any).route === 'pages/wiki/wiki') {
      wx.navigateBack()
      return
    }
    wx.navigateTo({ url: '/pages/wiki/wiki' })
  }
})
