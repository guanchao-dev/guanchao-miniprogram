import { contentApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'
import { mediaUrl, preloadImage } from '../../utils/upload'

// 特殊分类：查看我收藏的图鉴
const FAV = '__fav'

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
    newIds: [] as string[] // 刚点亮、还没看过 —— 只给这些加闪光
  },

  onShow() {
    this.load()
  },

  onCat(e: any) {
    this.setData({ category: e.currentTarget.dataset.id || '' })
    this.load()
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
        // 这里**不**标记「看过」。
        // 之前是列表一渲染就把整批新物种标成已看过，等于用户还没看清是哪个、
        // 状态就被消耗掉了，闪光和 NEW 角标几乎没法被观察到。
        // 现在改成「点进那个物种的详情页」才算看过 —— 语义更准，效果也能留住。
        // 见 pages/wiki-detail/wiki-detail.ts 的 load()。
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
    const params: Record<string, any> = { page: 1, pageSize: 50 }
    if (this.data.category) params.category = this.data.category
    contentApi.encyclopedia(params)
      .then((res) => this.paint(res.list || []))
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
      .then((data) => this.paint((data && data.list) || []))
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
