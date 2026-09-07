import { communityApi } from '../../services/api'
import { showError, toast } from '../../utils/format'
import { splitWaterfall } from '../../utils/waterfall'

const HISTORY_KEY = 'communitySearchHistory'

Page({
  data: {
    keyword: '',
    type: 'all',
    types: [
      { id: 'all', name: '全部' },
      { id: 'note', name: '笔记' },
      { id: 'user', name: '同学' },
      { id: 'topic', name: '话题' }
    ],
    searched: false,
    hot: [],
    history: [],
    notes: [],
    users: [],
    topics: [],
    left: [],
    right: []
  },

  onLoad(query: any) {
    this.setData({
      history: wx.getStorageSync(HISTORY_KEY) || [],
      keyword: (query && query.keyword) || ''
    })
    communityApi.hotKeywords()
      .then((res) => this.setData({ hot: res.list || [] }))
      .catch(() => {})
    if (query && (query.keyword || query.topicId)) {
      if (query.topicId) this.setData({ type: 'note' })
      this.onSearch()
    }
  },

  onInput(e: any) {
    this.setData({ keyword: (e.detail.value || '').trim() })
  },

  onHot(e: any) {
    this.setData({ keyword: e.currentTarget.dataset.word || '' })
    this.onSearch()
  },

  onType(e: any) {
    this.setData({ type: e.currentTarget.dataset.id || 'all' })
    if (this.data.searched) this.onSearch()
  },

  clearHistory() {
    wx.removeStorageSync(HISTORY_KEY)
    this.setData({ history: [] })
  },

  onSearch() {
    const keyword = this.data.keyword
    if (!keyword) {
      toast('请输入关键词')
      return
    }
    const history = [keyword].concat((this.data.history || []).filter((item: string) => item !== keyword)).slice(0, 8)
    wx.setStorageSync(HISTORY_KEY, history)
    this.setData({ history })
    communityApi.search({ keyword, type: this.data.type })
      .then((res) => {
        const notes = (res.notes && res.notes.list) || []
        const cols = splitWaterfall(notes)
        this.setData({
          searched: true,
          notes,
          users: (res.users && res.users.list) || [],
          topics: (res.topics && res.topics.list) || [],
          left: cols.left,
          right: cols.right
        })
      })
      .catch((err) => showError(err, '搜索失败'))
  },

  openNote(e: any) {
    wx.navigateTo({ url: `/pages/community-detail/community-detail?id=${e.currentTarget.dataset.id}` })
  },

  openUser(e: any) {
    wx.navigateTo({ url: `/pages/community-user/community-user?id=${e.currentTarget.dataset.id}` })
  },

  openTopic(e: any) {
    const id = e.currentTarget.dataset.id
    const hit = (this.data.topics || []).find((item: any) => item.id === id)
    this.setData({ keyword: (hit && hit.name) || this.data.keyword, type: 'note' })
    this.onSearch()
  }
})
