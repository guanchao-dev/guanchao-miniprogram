import { communityApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { flushUnlocks } from '../../utils/unlock'

Page({
  data: {
    noteId: '',
    note: { imageUrls: [], topics: [], author: {}, spot: {}, species: {} },
    comments: [],
    draft: ''
  },

  onLoad(query: any) {
    const id = query && query.id
    if (!id) return
    this.setData({ noteId: id })
    this.load()
  },

  onShow() {
    flushUnlocks(this)
  },

  onShareAppMessage() {
    const note: any = this.data.note
    return {
      title: note.title || '我在观潮社区看到一篇观察笔记',
      path: `/pages/community-detail/community-detail?id=${this.data.noteId}`
    }
  },

  load() {
    const id = this.data.noteId
    communityApi.note(id)
      .then((note) => {
        if (!note) throw new Error('笔记不存在')
        this.setData({
          note: Object.assign({ imageUrls: [], topics: [], author: {}, spot: {}, species: {} }, note)
        })
      })
      .catch((err) => showError(err, '笔记加载失败'))
    communityApi.comments(id)
      .then((res) => this.setData({ comments: res.list || [] }))
      .catch(() => this.setData({ comments: [] }))
  },

  preview(e: any) {
    const urls = this.data.note.imageUrls || []
    wx.previewImage({ current: e.currentTarget.dataset.url, urls })
  },

  onTopic(e: any) {
    const name = e.currentTarget.dataset.name
    wx.navigateTo({ url: `/pages/community-search/community-search?keyword=${encodeURIComponent(name)}` })
  },

  openWiki(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${id}` })
  },

  openAuthor() {
    const author: any = this.data.note.author || {}
    if (!author.id) return
    wx.navigateTo({ url: `/pages/community-user/community-user?id=${author.id}` })
  },

  onFollow() {
    if (!requireLogin()) return
    const author: any = this.data.note.author || {}
    const req = author.followed ? communityApi.unfollow(author.id) : communityApi.follow(author.id)
    req.then((res) => {
      this.setData({
        'note.author.followed': !!(res && res.followed),
        'note.author.followerCount': res && res.followerCount
      })
    }).catch((err) => showError(err, '关注失败'))
  },

  onLike() {
    if (!requireLogin()) return
    const note: any = this.data.note
    const req = note.liked ? communityApi.unlike(note.id) : communityApi.like(note.id)
    req.then((res) => this.setData({
      'note.liked': !!(res && res.liked),
      'note.likeCount': res && res.likeCount
    })).catch((err) => showError(err, '点赞失败'))
  },

  onFavorite() {
    if (!requireLogin()) return
    const note: any = this.data.note
    const req = note.favorited ? communityApi.unfavorite(note.id) : communityApi.favorite(note.id)
    req.then((res) => this.setData({
      'note.favorited': !!(res && res.favorited),
      'note.favoriteCount': res && res.favoriteCount
    })).catch((err) => showError(err, '收藏失败'))
  },

  onDraft(e: any) {
    this.setData({ draft: e.detail.value })
  },

  onComment() {
    if (!requireLogin()) return
    const content = (this.data.draft || '').trim()
    if (content.length < 2) {
      toast('再写两个字吧')
      return
    }
    communityApi.addComment(this.data.noteId, content)
      .then((item) => {
        this.setData({
          draft: '',
          comments: [item].concat(this.data.comments || []),
          'note.commentCount': (this.data.note.commentCount || 0) + 1
        })
      })
      .catch((err) => showError(err, '评论失败'))
  },

  onShare() {
    toast('点击右上角转发给好友')
  }
})
