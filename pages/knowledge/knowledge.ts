import { contentApi } from '../../services/api'
import { showError } from '../../utils/format'

function normalize(item: any) {
  return {
    id: item.id,
    title: item.title || '',
    summary: item.summary || '',
    body: item.body || item.summary || '',
    tags: item.tags || []
  }
}

Page({
  data: {
    loading: true,
    list: [],
    showDetail: false,
    detailLoading: false,
    detail: {
      id: '',
      title: '',
      summary: '',
      body: '',
      tags: []
    }
  },

  onShow() {
    this.load()
  },

  load() {
    this.setData({ loading: true })
    contentApi.knowledge()
      .then((list) => this.setData({ list: (list || []).map(normalize) }))
      .catch((err) => {
        this.setData({ list: [] })
        showError(err, '科普加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  onOpen(e: any) {
    const id = e.currentTarget.dataset.id
    this.setData({
      showDetail: true,
      detailLoading: true,
      detail: { id, title: '', summary: '', body: '', tags: [] }
    })
    contentApi.knowledgeDetail(id)
      .then((detail) => {
        if (detail) this.setData({ detail: normalize(detail) })
      })
      .catch((err) => showError(err, '内容加载失败'))
      .finally(() => this.setData({ detailLoading: false }))
  },

  closeDetail() {
    this.setData({ showDetail: false })
  },

  noop() {}
})
