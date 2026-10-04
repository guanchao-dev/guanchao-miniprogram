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
      .then((faq) => {
        const list = (faq || []).map((item: any) => ({ ...item, open: false }))
        this.setData({ faq: list })
      })
      .catch((err) => {
        this.setData({ faq: [] })
        showError(err, '常见问题加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  toggleItem(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    const key = `faq[${index}].open`
    this.setData({ [key]: !this.data.faq[index].open })
  }
})
