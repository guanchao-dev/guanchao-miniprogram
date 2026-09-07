import { contentApi } from '../../services/api'
import { showError } from '../../utils/format'

function distanceText(m: any): string {
  const n = Number(m)
  if (!n && n !== 0) return ''
  return n >= 1000 ? `${(n / 1000).toFixed(1)}km` : `${Math.round(n)}m`
}

Page({
  data: {
    list: []
  },

  onShow() {
    this.load()
  },

  load() {
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
              distanceText: distanceText(item.distanceM)
            }))
          })
        })
        .catch((err) => showError(err, '点位加载失败'))
    }

    wx.getLocation({
      type: 'gcj02',
      success: (res: any) => apply({ lat: res.latitude, lng: res.longitude, page: 1, pageSize: 20 }),
      fail: () => apply({ city: '青岛', page: 1, pageSize: 20 })
    })
  },

  openDetail(e: any) {
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${e.currentTarget.dataset.id}` })
  }
})
