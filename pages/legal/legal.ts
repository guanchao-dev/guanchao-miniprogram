import { contentApi } from '../../services/api'
import { showError, toast } from '../../utils/format'

Page({
  data: {
    legal: {}
  },

  onShow() {
    contentApi.legal()
      .then((legal) => this.setData({ legal: legal || {} }))
      .catch((err) => showError(err, '协议加载失败'))
  },

  copyUrl(e: any) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.setClipboardData({
      data: url,
      success: () => toast('已复制')
    })
  }
})
