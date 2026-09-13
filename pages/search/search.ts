import { contentApi, homeApi } from '../../services/api'
import { showError, toast } from '../../utils/format'

Page({
  data: {
    keyword: '',
    searched: false,
    spots: [],
    species: []
  },

  onLoad(query: Record<string, string>) {
    const keyword = decodeURIComponent((query && query.keyword) || '').trim()
    if (!keyword) return
    this.setData({ keyword }, () => this.onSearch())
  },

  onInput(e: any) {
    this.setData({ keyword: e.detail.value || '' })
  },

  onSearch() {
    const keyword = (this.data.keyword || '').trim()
    if (!keyword) {
      toast('请输入关键词')
      return
    }
    this.setData({ keyword })
    const apply = (spots: any[], species: any[]) => {
      this.setData({ searched: true, spots, species })
    }
    homeApi.search(keyword)
      .then((data) => {
        apply((data && data.spots && data.spots.list) || [], (data && data.species && data.species.list) || [])
      })
      .catch(() => {
        Promise.all([
          contentApi.spots({ keyword, page: 1, pageSize: 50 }),
          contentApi.encyclopedia({ keyword, page: 1, pageSize: 20 })
        ]).then(([spots, wiki]) => {
          apply(spots.list || [], wiki.list || [])
        }).catch((err) => showError(err, '搜索失败'))
      })
  },

  openSpot(e: any) {
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${e.currentTarget.dataset.id}` })
  },

  openWiki(e: any) {
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${e.currentTarget.dataset.id}` })
  }
})
