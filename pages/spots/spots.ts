import { contentApi } from '../../services/api'
import { showError } from '../../utils/format'
import { formatDistance, setCachedLocation } from '../../utils/spotGuide'

Page({
  data: {
    loading: true,
    list: []
  },

  onShow() {
    this.load()
  },

  load() {
    this.setData({ loading: true })
    const apply = (params: Record<string, any>) => {
      contentApi.spots(params)
        .then((res) => {
          this.setData({
            list: (res.list || []).map((item: any) => ({
              id: item.id,
              name: item.name,
              city: item.city,
              openTime: item.openTime || '',
              safetyTags: item.safetyTags || [],
              distanceText: formatDistance(item.distanceM)
            }))
          })
        })
        .catch((err) => {
          this.setData({ list: [] })
          showError(err, '点位加载失败')
        })
        .finally(() => this.setData({ loading: false }))
    }

    wx.getLocation({
      type: 'gcj02',
      success: (res: any) => {
        // 缓存给首页热度榜/点位详情复用
        setCachedLocation(res.latitude, res.longitude)
        apply({ lat: res.latitude, lng: res.longitude, page: 1, pageSize: 20 })
      },
      fail: () => apply({ city: '青岛', page: 1, pageSize: 20 })
    })
  },

  openDetail(e: any) {
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${e.currentTarget.dataset.id}` })
  }
})
