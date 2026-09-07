import { communityApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'
import { flushUnlocks } from '../../utils/unlock'
import { splitWaterfall } from '../../utils/waterfall'

Page({
  data: {
    tab: 'recommend',
    topicId: '',
    topics: [{ id: '', name: '全部' }],
    left: [],
    right: [],
    emptyText: '还没有观察笔记'
  },

  onShow() {
    this.loadTopics()
    this.loadFeed()
    flushUnlocks(this)
  },

  onPullDownRefresh() {
    this.loadFeed().finally(() => wx.stopPullDownRefresh())
  },

  onTab(e: any) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab, topicId: tab === 'following' ? '' : this.data.topicId })
    this.loadFeed()
  },

  onTopic(e: any) {
    if (this.data.tab === 'following') return
    this.setData({ topicId: e.currentTarget.dataset.id || '' })
    this.loadFeed()
  },

  loadTopics() {
    communityApi.topics()
      .then((res) => {
        this.setData({ topics: [{ id: '', name: '全部' }].concat(res.list || []) })
      })
      .catch(() => {})
  },

  loadFeed() {
    const params: Record<string, any> = { tab: this.data.tab, page: 1, pageSize: 20 }
    if (this.data.tab === 'recommend' && this.data.topicId) params.topicId = this.data.topicId
    return communityApi.feed(params)
      .then((res) => {
        const cols = splitWaterfall(res.list || [])
        this.setData({
          left: cols.left,
          right: cols.right,
          emptyText: this.data.tab === 'following' ? '还没有关注的人，去推荐流看看吧' : '还没有观察笔记'
        })
      })
      .catch((err) => showError(err, '社区加载失败'))
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/community-search/community-search' })
  },

  goPublish() {
    if (!requireLogin()) return
    wx.navigateTo({ url: '/pages/community-publish/community-publish' })
  },

  openNote(e: any) {
    wx.navigateTo({ url: `/pages/community-detail/community-detail?id=${e.currentTarget.dataset.id}` })
  }
})
