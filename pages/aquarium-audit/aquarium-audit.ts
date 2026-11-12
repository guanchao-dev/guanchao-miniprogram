import http from '../../utils/http'
import { mediaUrl } from '../../utils/upload'
import { showError } from '../../utils/format'

const STATUS_TEXT: Record<string, string> = {
  approved: '已通过',
  appealed: '复核中',
  rejected: '未通过'
}

Page({
  data: {
    loading: true,
    list: [] as any[]
  },

  onShow() {
    this.load()
  },

  load() {
    this.setData({ loading: true })
    // 只要用户点过申诉的：复核中 / 申诉成功 / 申诉未通过
    http.get('/uploads/mine', {
      scene: 'aquarium',
      appealedOnly: 1,
      page: 1,
      pageSize: 50
    }, { cacheTtl: 0 })
      .then((res: any) => {
        const list = ((res && res.list) || []).map((it: any) => {
          const used = !!it.usedAt
          return {
            uploadId: it.uploadId,
            status: it.status,
            used,
            statusText:
              it.status === 'approved' && used
                ? '已加入潮池'
                : (STATUS_TEXT[it.status] || it.status),
            rejectReason: it.rejectReason || '',
            previewUrl: mediaUrl(it.previewUrl || ''),
            timeText: String(it.createdAt || '').replace('T', ' ').replace('Z', '').slice(5, 16)
          }
        })
        this.setData({ list })
      })
      .catch((err) => {
        this.setData({ list: [] })
        showError(err, '申诉记录加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  /** 申诉成功：进入正常制作流程，把这张图加入潮池 */
  onPlace(e: any) {
    const id = String((e.currentTarget.dataset.id) || '')
    const item = (this.data.list as any[]).find((x) => x.uploadId === id)
    if (!id || !item) return
    wx.navigateTo({
      url: '/pages/aquarium-add/aquarium-add?uploadId=' + encodeURIComponent(id) +
        '&src=' + encodeURIComponent(item.previewUrl)
    })
  }
})
