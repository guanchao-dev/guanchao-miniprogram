import { contentApi } from '../../services/api'
import { showError } from '../../utils/format'
import { mediaUrl, preloadImage } from '../../utils/upload'

Page({
  data: {
    category: '',
    cats: [
      { id: '', name: '全部' },
      { id: 'shell', name: '贝类' },
      { id: 'crab', name: '蟹类' },
      { id: 'algae', name: '海藻' },
      { id: 'fish', name: '鱼类' },
      { id: 'other', name: '其他' }
    ],
    list: []
  },

  onShow() {
    this.load()
  },

  onCat(e: any) {
    this.setData({ category: e.currentTarget.dataset.id || '' })
    this.load()
  },

  load() {
    const params: Record<string, any> = { page: 1, pageSize: 50 }
    if (this.data.category) params.category = this.data.category
    contentApi.encyclopedia(params)
      .then((res) => {
        const raw = res.list || []
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
      })
      .catch((err) => showError(err, '图鉴加载失败'))
  },

  openDetail(e: any) {
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${e.currentTarget.dataset.id}` })
  }
})
