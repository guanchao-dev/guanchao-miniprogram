import { contentApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'

Page({
  data: {
    feedback: '',
    contact: '',
    submitting: false,
    tags: ['🌊 潮汐查询', '🐚 生物识别', '🦀 赶海打卡']
  },

  onFeedbackInput(e: any) {
    this.setData({ feedback: e.detail.value })
  },

  onContactInput(e: any) {
    this.setData({ contact: e.detail.value })
  },

  onSubmitFeedback() {
    if (!requireLogin()) return
    const content = (this.data.feedback || '').trim()
    if (!content) {
      toast('请先填写反馈内容')
      return
    }
    if (this.data.submitting) return
    this.setData({ submitting: true })
    contentApi.feedback({ content, contact: (this.data.contact || '').trim() })
      .then(() => {
        this.setData({ feedback: '', contact: '', submitting: false })
        toast('感谢你的反馈')
      })
      .catch((err) => {
        this.setData({ submitting: false })
        showError(err, '提交失败')
      })
  }
})
