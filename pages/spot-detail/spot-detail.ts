import { contentApi } from '../../services/api'
import { showError, toast } from '../../utils/format'
import { navigateSpot } from '../../utils/amapNav'

Page({
  data: {
    spot: {}
  },

  onLoad(query: any) {
    const id = query && query.id
    if (!id) return
    contentApi.spot(id)
      .then((spot) => this.setData({
        spot: Object.assign({ safetyTags: [], gearList: [] }, spot, {
          gearList: (spot.gearList || []).map((item: any) =>
            typeof item === 'string' ? item : (item && (item.name || item.title)) || ''
          ).filter(Boolean)
        })
      }))
      .catch((err) => showError(err, '点位详情加载失败'))
  },

  useSpot() {
    const spot: any = this.data.spot
    if (!spot.id) return
    const app = getApp()
    if (app.globalData) {
      app.globalData.spotId = spot.id
      app.globalData.placeName = spot.name
    }
    toast('已切换观察点')
    wx.switchTab({ url: '/pages/home/home' })
  },

  onNavigate() {
    const spot: any = this.data.spot
    navigateSpot({
      name: spot.name,
      navName: spot.navName || spot.parkingName,
      latitude: Number(spot.latitude || spot.lat),
      longitude: Number(spot.longitude || spot.lng)
    })
  }
})
