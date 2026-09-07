import { communityApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'
import { splitWaterfall } from '../../utils/waterfall'

Page({
  data: {
    userId: 'me',
    tab: 'notes',
    user: {},
    left: [],
    right: []
  },

  onLoad(query: any) {
    this.setData({
      userId: (query && query.id) || 'me',
      tab: (query && query.tab) || 'notes'
    })
  },

  onShow() {
    this.load()
  },

  onTab(e: any) {
    this.setData({ tab: e.currentTarget.dataset.tab || 'notes' })
    this.load()
  },

  load() {
    communityApi.user(this.data.userId, this.data.tab)
      .then((res) => {
        const cols = splitWaterfall((res.notes && res.notes.list) || [])
        this.setData({
          user: res.user || {},
          left: cols.left,
          right: cols.right
        })
      })
      .catch((err) => showError(err, '主页加载失败'))
  },

  onFollow() {
    if (!requireLogin()) return
    const user: any = this.data.user
    const req = user.followed ? communityApi.unfollow(user.id) : communityApi.follow(user.id)
    req.then((res) => this.setData({
      'user.followed': !!(res && res.followed),
      'user.followerCount': res && res.followerCount
    })).catch((err) => showError(err, '关注失败'))
  },

  openNote(e: any) {
    wx.navigateTo({ url: `/pages/community-detail/community-detail?id=${e.currentTarget.dataset.id}` })
  }
})
