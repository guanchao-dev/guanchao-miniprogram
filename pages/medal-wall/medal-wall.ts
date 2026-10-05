import { achieveApi } from '../../services/api'
import { decorateMedal, sortMedals } from '../../utils/medals'

Page({
  data: {
    medals: [],
    loading: true,
    unlockedCount: 0,
    total: 0,
    percent: 0
  },

  onShow() {
    this.loadMedals()
  },

  /** 展示全部勋章：已解锁排前面，一行 4 个，解锁的带金边 */
  loadMedals() {
    this.setData({ loading: true })
    achieveApi.medals()
      .then((data) => {
        const sorted = sortMedals((data && (data.list || data)) || [])
        const unlockedCount = sorted.filter((item: any) => !item.locked).length
        const total = sorted.length
        this.setData({
          medals: sorted.map(decorateMedal),
          unlockedCount,
          total,
          percent: total ? Math.round((unlockedCount / total) * 100) : 0
        })
      })
      .catch(() => this.setData({ medals: [] }))
      .finally(() => this.setData({ loading: false }))
  },

  goMedalDetail(e: any) {
    const medal = this.data.medals[e.currentTarget.dataset.index]
    if (!medal || !medal.id) return
    const app = getApp()
    if (app.globalData) app.globalData.medalPreview = medal
    wx.navigateTo({ url: `/pages/medal-detail/medal-detail?id=${medal.id}` })
  }
})