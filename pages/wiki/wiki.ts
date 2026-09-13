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
    emptyText: '暂无图鉴'
  },

  onShow() {
    this.load()
  },

  onCat(e: any) {
    this.setData({ category: e.currentTarget.dataset.id || '' })
    this.load()
  },

  load() {
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
    this.setData({
      list: raw.map((it: any) => ({
        id: it.id,
        name: it.name,
        coverSrc: ''
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
