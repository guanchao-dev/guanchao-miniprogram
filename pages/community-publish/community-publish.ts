import { DEFAULT_SPOT_ID } from '../../config/env'
import { communityApi } from '../../services/api'
import { showError, toast } from '../../utils/format'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'
import { chooseImages, uploadImage } from '../../utils/upload'

Page({
  data: {
    photos: [],
    title: '',
    content: '',
    topics: [],
    topicIds: [],
    spotId: DEFAULT_SPOT_ID,
    place: '青岛 · 石老人',
    submitting: false
  },

  onLoad() {
    const app = getApp()
    this.setData({
      spotId: (app.globalData && app.globalData.spotId) || DEFAULT_SPOT_ID,
      place: (app.globalData && app.globalData.placeName) || '青岛 · 石老人'
    })
    communityApi.topics()
      .then((res) => this.setData({
        topics: (res.list || []).map((item: any) => Object.assign({}, item, { on: false }))
      }))
      .catch(() => {})
  },

  addPhoto() {
    const remain = 9 - this.data.photos.length
    if (remain <= 0) return
    chooseImages(remain)
      .then((list) => this.setData({ photos: this.data.photos.concat(list) }))
      .catch((err) => {
        if (err && err.message === 'cancel') return
        showError(err, '选择照片失败')
      })
  },

  removePhoto(e: any) {
    const photos = this.data.photos.slice()
    photos.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ photos })
  },

  onTitle(e: any) {
    this.setData({ title: e.detail.value })
  },

  onContent(e: any) {
    this.setData({ content: e.detail.value })
  },

  onTopic(e: any) {
    const id = e.currentTarget.dataset.id
    const topics = (this.data.topics || []).map((item: any) => {
      if (item.id !== id) return item
      return Object.assign({}, item, { on: !item.on })
    })
    const topicIds = topics.filter((item: any) => item.on).map((item: any) => item.id).slice(0, 3)
    this.setData({
      topics: topics.map((item: any) => Object.assign({}, item, { on: topicIds.indexOf(item.id) >= 0 })),
      topicIds
    })
  },

  onSubmit() {
    if (this.data.submitting) return
    const title = (this.data.title || '').trim()
    const content = (this.data.content || '').trim()
    if (!this.data.photos.length) {
      toast('至少放一张观察照片')
      return
    }
    if (title.length < 4) {
      toast('标题至少 4 个字')
      return
    }
    if (content.length < 10) {
      toast('观察至少 10 个字')
      return
    }
    this.setData({ submitting: true })
    wx.showLoading({ title: '发布中', mask: true })
    Promise.all(this.data.photos.map((path: string) =>
      uploadImage('community', path).catch(() => '')
    ))
      .then((uploadIds) => communityApi.createNote({
        uploadIds: uploadIds.filter(Boolean),
        imageUrls: this.data.photos,
        title,
        content,
        topicIds: this.data.topicIds,
        spotId: this.data.spotId,
        spotName: this.data.place,
        visibility: 'public'
      }))
      .then((note) => {
        enqueueUnlocks((note && note.unlockedMedalIds) || [], 'community')
        flushUnlocks(this)
        toast('已发布')
        const id = note && note.id
        setTimeout(() => {
          if (id) {
            wx.redirectTo({ url: `/pages/community-detail/community-detail?id=${id}` })
          } else {
            wx.navigateBack()
          }
        }, 400)
      })
      .catch((err) => showError(err, '发布失败'))
      .finally(() => {
        this.setData({ submitting: false })
        wx.hideLoading()
      })
  }
})
