import { contentApi } from '../../services/api'
import { showError } from '../../utils/format'

Page({
  data: {
    loading: true,
    faq: []
  },

  onShow() {
    this.load()
  },

  load() {
    this.setData({ loading: true })
    contentApi.faq()
      .then((faq) => this.setData({ faq: faq || [] }))
      .catch((err) => {
        this.setData({ faq: [] })
        showError(err, '常见问题加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  }
})
