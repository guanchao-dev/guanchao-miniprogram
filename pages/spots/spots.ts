import { showError } from '../../utils/format'
import { enableShareMenu } from '../../utils/share'
import { loadGuideSpots } from '../../utils/spotGuide'

Page({
  data: {
    loading: true,
    list: []
  },

  onShow() {
    enableShareMenu()
    this.load()
  },

  onShareAppMessage() {
    return { title: '追潮记 · 赶海点推荐', path: '/pages/spots/spots' }
  },

  load() {
    this.setData({ loading: true })
    // 按当前地区取点位，定位成功时顺带算好距离
    loadGuideSpots()
      .then((list) => {
        this.setData({
          list: (list || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            city: item.city,
            openTime: item.openTime || '',
            safetyTags: item.safetyTags || [],
            distanceText: item.distanceText
          }))
        })
      })
      .catch((err) => {
        this.setData({ list: [] })
        showError(err, '点位加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  openDetail(e: any) {
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${e.currentTarget.dataset.id}` })
  }
})
