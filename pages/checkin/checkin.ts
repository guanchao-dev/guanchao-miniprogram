import { contentApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'

Page({
  data: {
    list: []
  },

  onShow() {
    if (!requireLogin()) return
    this.load()
  },

  load() {
    contentApi.checkins()
      .then((res) => this.setData({ list: res.list || [] }))
      .catch((err) => {
        this.setData({ list: [] })
        showError(err, '打卡记录加载失败')
      })
  },

  goDiscover() {
    if (!requireLogin()) return
    wx.navigateTo({ url: '/pages/discover/discover' })
  }
})
