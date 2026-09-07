import { contentApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'

Page({
  data: {
    faq: [],
    content: ''
  },

  onShow() {
    contentApi.faq()
      .then((faq) => this.setData({ faq: faq || [] }))
      .catch(() => this.setData({ faq: [] }))
  },

  onInput(e: any) {
    this.setData({ content: e.detail.value })
  },

  onSubmit() {
    if (!requireLogin()) return
    const content = (this.data.content || '').trim()
    if (!content) {
      toast('请先填写反馈')
      return
    }
    contentApi.feedback({ content })
      .then(() => {
        this.setData({ content: '' })
        toast('已提交，谢谢')
      })
      .catch((err) => showError(err, '提交失败'))
  }
})
