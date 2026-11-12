import { contentApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'
import { mediaUrl, preloadImage } from '../../utils/upload'

// 特殊分类：查看我收藏的图鉴
const FAV = '__fav'
const CATEGORY_NAMES: Record<string, string> = {
  shell: '赶海生物',
  crab: '赶海生物',
  algae: '赶海生物',
  fish: '赶海生物',
  other: '赶海生物',
  physical: '物理海洋',
  tech: '海洋科技',
  other_marine: '其他海洋生物'
}

Page({
  data: {
    group: 'forage',
    category: '',
    currentGroupName: '赶海生物',
    currentSubName: '',
    cats: [
      { id: 'forage', name: '赶海生物' },
      { id: 'physical', name: '物理海洋' },
      { id: 'tech', name: '海洋科技' },
      { id: 'other_marine', name: '其他海洋生物' },
      { id: FAV, name: '我的收藏' }
    ],
    subCats: [
      { id: '', name: '全部' },
      { id: 'shell', name: '贝类' },
      { id: 'crab', name: '蟹类' },
      { id: 'algae', name: '海藻' },
      { id: 'fish', name: '鱼类' },
      { id: 'other', name: '其他' }
    ],
    keyword: '',
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
    const id = e.currentTarget.dataset.id || 'forage'
    const cat = (this.data.cats as any[]).find((x) => x.id === id)
    this.setData({
      group: id,
      category: '',
      currentGroupName: (cat && cat.name) || '赶海生物',
      currentSubName: ''
    })
    this.load()
  },

  onSubCat(e: any) {
    const id = e.currentTarget.dataset.id || ''
    const cat = (this.data.subCats as any[]).find((x) => x.id === id)
    this.setData({
      category: id,
      currentSubName: id ? ((cat && cat.name) || '') : ''
    })
    this.load()
  },


  onInput(e: any) {
    this.setData({ keyword: e.detail.value || '' })
  },

  onSearch() {
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
    if (this.data.group === FAV) {
      this.loadFavorites()
      return
    }
    const keyword = (this.data.keyword || '').trim()
    this.setData({
      loading: true,
      list: [],
      emptyText: keyword ? '没有找到相关内容' : '暂无图鉴'
    })
    const params: Record<string, any> = { page: 1, pageSize: 50 }
    const group = this.data.group
    if (group === 'forage') {
      params.category = this.data.category || 'forage'
    } else {
      params.category = group
    }
    if (keyword) params.keyword = keyword
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
        category: it.category || '',
        categoryName: CATEGORY_NAMES[it.category] || '海洋图鉴',
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
