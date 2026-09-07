import { contentApi } from '../../services/api'
import { showError, toast } from '../../utils/format'

Page({
  data: {
    keyword: '',
    searched: false,
    spots: [],
    species: []
  },

  onInput(e: any) {
    this.setData({ keyword: (e.detail.value || '').trim() })
  },

  onSearch() {
    const keyword = this.data.keyword
    if (!keyword) {
      toast('请输入关键词')
      return
    }
    Promise.all([
      contentApi.spots({ keyword, page: 1, pageSize: 50 }),
      contentApi.encyclopedia({ keyword, page: 1, pageSize: 20 })
    ]).then(([spots, wiki]) => {
      this.setData({
        searched: true,
        spots: spots.list || [],
        species: wiki.list || []
      })
    }).catch((err) => showError(err, '搜索失败'))
  },

  openSpot(e: any) {
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${e.currentTarget.dataset.id}` })
  },

  openWiki(e: any) {
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${e.currentTarget.dataset.id}` })
  }
})
