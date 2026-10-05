import { contentApi } from '../../services/api'
import { showError } from '../../utils/format'

function distanceText(m: any): string {
  const n = Number(m)
  if (!n && n !== 0) return ''
  return n >= 1000 ? `${(n / 1000).toFixed(1)}km` : `${Math.round(n)}m`
}

Page({
  data: {
    loading: true,
    list: [] as any[],
    empty: false
  },

  onShow() {
    this.load()
  },

  load() {
    this.setData({ loading: true })
    const apply = (params: Record<string, any>) => {
      contentApi.treasureSpots(params)
        .then((res) => {
          const list = (res.list || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            city: item.city || '',
            note: item.observeHint || '',
            openTime: item.openTime || '',
            safetyTags: item.safetyTags || [],
            distanceText: distanceText(item.distanceM)
          }))
          this.setData({ list, empty: list.length === 0 })
        })
        .catch((err) => {
          this.setData({ list: [], empty: true })
          showError(err, '宝藏地点加载失败')
        })
        .finally(() => this.setData({ loading: false }))
    }

    // 有定位就按距离展示，没有也能看（不强制授权）
    wx.getLocation({
      type: 'gcj02',
      success: (res: any) => apply({ lat: res.latitude, lng: res.longitude, page: 1, pageSize: 50 }),
      fail: () => apply({ page: 1, pageSize: 50 })
    })
  },

  openDetail(e: any) {
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${e.currentTarget.dataset.id}` })
  },

  goShare() {
    wx.navigateTo({ url: '/pages/spot-share/spot-share' })
  }
})
