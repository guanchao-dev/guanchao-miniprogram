import { DEFAULT_SPOT_ID } from '../../config/env'
import { homeApi } from '../../services/api'
import { showError, todayDate } from '../../utils/format'

Page({
  data: {
    spotId: DEFAULT_SPOT_ID,
    month: todayDate().slice(0, 7),
    days: []
  },

  onLoad() {
    this.syncSpot()
    this.load()
  },

  onShow() {
    const prev = this.data.spotId
    this.syncSpot()
    if (this.data.spotId !== prev) this.load()
  },

  syncSpot() {
    const app = getApp()
    this.setData({
      spotId: (app.globalData && app.globalData.spotId) || DEFAULT_SPOT_ID
    })
  },

  onMonth(e: any) {
    const value = e.detail.value || this.data.month
    this.setData({ month: String(value).slice(0, 7) })
    this.load()
  },

  load() {
    homeApi.tideCalendar({ spotId: this.data.spotId, month: this.data.month })
      .then((data) => {
        const days = (data && (data.days || data.list)) || []
        this.setData({
          days: days.map((item: any) => ({
            date: item.date,
            lowText: (item.lowTimes || []).join(' / ') || '--',
            highText: (item.highTimes || []).join(' / ') || '--',
            observeHint: item.observeHint || ''
          }))
        })
      })
      .catch((err) => showError(err, '日历加载失败'))
  }
})
