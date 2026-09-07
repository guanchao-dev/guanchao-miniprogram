import { cardApi } from '../../services/api'
import { showError } from '../../utils/format'

Page({
  data: {
    list: []
  },

  onShow() {
    cardApi.list()
      .then((data) => {
        this.setData({ list: (data && (data.list || data)) || [] })
      })
      .catch((err) => showError(err, '图鉴卡加载失败'))
  },

  onOpen(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/discover/discover?id=${id}` })
  }
})
