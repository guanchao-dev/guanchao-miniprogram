import { contentApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'
import { mediaUrl, preloadImage } from '../../utils/upload'

// 特殊分类：查看我收藏的图鉴
const FAV = '__fav'

// 图鉴一页 8 个（两列四行）
const PAGE_SIZE = 8

Page({
  data: {
    category: '',
    cats: [
      { id: '', name: '全部' },
      { id: FAV, name: '我的收藏' },
      { id: 'shell', name: '贝类' },
      { id: 'crab', name: '蟹类' },
      { id: 'algae', name: '海藻' },
      { id: 'fish', name: '鱼类' },
      { id: 'other', name: '其他' }
    ],
    loading: true,
    list: [],
    emptyText: '暂无图鉴',
    litCount: 0,
    totalCount: 0,
    litIds: [] as string[],
    newIds: [] as string[], // 刚点亮、还没看过 —— 只给这些加闪光
    page: 1,
    totalPages: 1,
    // 翻页动效：两个类名交替用，保证每次翻页 class 都变、动画才会重放
    flipCls: 'flip-a',
    favAll: [] as any[] // 收藏接口不支持分页，全量拉回来在前端切页
  },

  onShow() {
    this.load()
  },

  onCat(e: any) {
    // 换分类要回到第一页，否则会停在一个空的页码上
    this.setData({ category: e.currentTarget.dataset.id || '', page: 1 })
    this.load()
  },

  prevPage() {
    if (this.data.page <= 1) return
    this.setData({ page: this.data.page - 1 })
    this.load()
  },

  nextPage() {
    if (this.data.page >= this.data.totalPages) return
    this.setData({ page: this.data.page + 1 })
    this.load()
  },

  /** 翻页时重放一次网格入场动效。交替两个类名，class 变了动画才会重新触发 */
  playFlip() {
    this.setData({ flipCls: this.data.flipCls === 'flip-a' ? 'flip-b' : 'flip-a' })
  },

  /**
   * 拉「我点亮的物种」集合：顶部进度条 + 列表点亮态都用它。
   * 收藏列表走的是 /encyclopedia/favorites，不带 lit 字段，所以统一用这个集合判断，
   * 两种列表的渲染逻辑才一致。
   */
  refreshUnlocked() {
    contentApi.encyclopediaUnlocked()
      .then((d: any) => {
        const newIds: string[] = (d && d.newSpeciesIds) || []
        this.setData({
          litIds: (d && d.speciesIds) || [],
          newIds,
          litCount: (d && d.litCount) || 0,
          totalCount: (d && d.totalCount) || 0
        })
        this.markLit()
        // 已经展示给用户了，标记为「看过」—— 下次进图鉴这些物种只保留金边、不再闪光。
        // 只动服务端标记，本地 newIds 不动，所以这一次进来还是会完整闪一遍。
        if (newIds.length) {
          contentApi.markSpeciesSeen(newIds).catch(() => {})
        }
      })
      .catch(() => {
        // 拿不到不影响看图鉴，只是不显示点亮态
      })
  },

  /** 集合到位后回填已渲染列表的点亮态与「新获得」态 */
  markLit() {
    const { litIds, newIds } = this.data
    this.setData({
      list: this.data.list.map((it: any) => ({
        ...it,
        lit: litIds.indexOf(it.id) >= 0,
        isNew: newIds.indexOf(it.id) >= 0
      }))
    })
  },

  load() {
    this.refreshUnlocked()
    if (this.data.category === FAV) {
      this.loadFavorites()
      return
    }
    this.setData({ loading: true, list: [], emptyText: '暂无图鉴' })
    const params: Record<string, any> = { page: this.data.page, pageSize: PAGE_SIZE }
    if (this.data.category) params.category = this.data.category
    contentApi.encyclopedia(params)
      .then((res) => {
        const raw = (res && res.raw) || {}
        const total = Number(raw.total) || 0
        this.setData({ totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) })
        this.paint(res.list || [])
        this.playFlip()
      })
      .catch((err) => {
        this.setData({ list: [] })
        showError(err, '图鉴加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  loadFavorites() {
    if (!isLoggedIn()) {
      this.setData({ loading: false, list: [], emptyText: '登录后可查看收藏的图鉴' })
      requireLogin()
      return
    }
    this.setData({ loading: true, list: [], emptyText: '还没有收藏的图鉴' })
    contentApi.favorites()
      .then((data) => {
        // 收藏接口不分页，一次全拉回来在这里切页 —— 收藏量小，够用
        const all = (data && data.list) || []
        const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
        const page = Math.min(this.data.page, totalPages)
        this.setData({ favAll: all, totalPages, page })
        this.paint(all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE))
        this.playFlip()
      })
      .catch((err) => {
        this.setData({ list: [] })
        showError(err, '收藏加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  paint(raw: any[]) {
    const { litIds, newIds } = this.data
    this.setData({
      list: raw.map((it: any) => ({
        id: it.id,
        name: it.name,
        coverSrc: '',
        lit: litIds.indexOf(it.id) >= 0,
        isNew: newIds.indexOf(it.id) >= 0
      }))
    })
    raw.forEach((it: any, i: number) => {
      preloadImage(mediaUrl(it.coverUrl || '')).then((src) => {
        if (src) this.setData({ [`list[${i}].coverSrc`]: src })
      })
    })
  },

  openDetail(e: any) {
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${e.currentTarget.dataset.id}` })
  }
})
