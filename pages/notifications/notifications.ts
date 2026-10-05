import { contentApi } from '../../services/api'
import { showError } from '../../utils/format'
import { requireLogin } from '../../utils/auth'

Page({
  data: {
    loading: true,
    list: [] as any[],
    empty: false,
    // 和 empty 分开：「加载失败」不能显示成「还没有消息」，会让人以为没收到
    failed: false
  },

  onShow() {
    this.load()
  },

  load() {
    // 消息是跟账号走的，未登录先去登录
    if (!requireLogin()) {
      this.setData({ loading: false, failed: true })
      return
    }
    this.setData({ loading: true })
    contentApi
      .notifications({ page: 1, pageSize: 50 })
      .then((res: any) => {
        const list = (res.list || []).map((m: any) => ({
          id: String(m.id || ''),
          content: m.content || '',
          reply: m.reply || '',
          spotName: m.spotName || '',
          repliedAt: m.repliedAt || '',
          seen: !!m.seen
        }))
        this.setData({ list, empty: list.length === 0, failed: false, loading: false })
        // 进来就算看过了：清掉未读，铃铛上的红点随之消失。
        // 失败不影响展示，所以不弹错。
        if (res.unread) {
          contentApi.markNotificationsRead().catch(() => {})
        }
      })
      .catch((err) => {
        this.setData({ loading: false, failed: true })
        showError(err, '消息加载失败')
      })
  }
})
