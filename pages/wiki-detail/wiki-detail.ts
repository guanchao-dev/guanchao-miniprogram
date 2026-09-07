import { contentApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { chooseImage, downloadImage, mediaUrl, preloadImage } from '../../utils/upload'

Page({
  data: {
    item: {},
    akaText: '',
    coverUrl: '',
    coverSrc: '',
    photos: []
  },

  onLoad(query: any) {
    const id = query && query.id
    if (!id) return
    this.load(id)
  },

  load(id: string) {
    contentApi.species(id)
      .then((item) => {
        const coverUrl = mediaUrl(item.coverUrl || '')
        this.setData({
          item: Object.assign({ favorited: false }, item),
          akaText: (item.aka || []).join('、'),
          coverUrl
        })
        preloadImage(coverUrl).then((src) => {
          if (src) this.setData({ coverSrc: src })
        })
        this.loadPhotos(id)
      })
      .catch((err) => showError(err, '图鉴详情加载失败'))
  },

  loadPhotos(speciesId: string) {
    if (!isLoggedIn()) return
    contentApi.speciesPhotos(speciesId)
      .then((data) => {
        const list = (data && data.list) || []
        this.setData({
          photos: list.map((p: any) => ({
            photoId: p.photoId,
            coverUrl: mediaUrl(p.coverUrl || ''),
            coverSrc: ''
          }))
        })
        list.forEach((p: any, i: number) => {
          downloadImage(mediaUrl(p.coverUrl || '')).then((src) => {
            if (src) this.setData({ [`photos[${i}].coverSrc`]: src })
          })
        })
      })
      .catch(() => {})
  },

  onFavorite() {
    if (!requireLogin()) return
    const item: any = this.data.item
    if (!item.id) return
    const req = item.favorited
      ? contentApi.unfavoriteSpecies(item.id)
      : contentApi.favoriteSpecies(item.id)
    req.then(() => {
      this.setData({ 'item.favorited': !item.favorited })
      toast(item.favorited ? '已取消收藏' : '已收藏')
    }).catch((err) => showError(err, '收藏失败'))
  },

  onUploadPhoto() {
    if (!requireLogin()) return
    const item: any = this.data.item
    if (!item.id) return
    chooseImage()
      .then((filePath) => {
        wx.showLoading({ title: '上传中', mask: true })
        return contentApi.uploadSpeciesPhoto(item.id, filePath)
      })
      .then(() => {
        wx.hideLoading()
        toast('上传成功')
        this.loadPhotos(item.id)
      })
      .catch((err) => {
        wx.hideLoading()
        if (err && err.message === 'cancel') return
        showError(err, '上传失败')
      })
  },

  onPreviewPhoto(e: any) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ current: url, urls: [url] })
  },

  onDeletePhoto(e: any) {
    if (!requireLogin()) return
    const item: any = this.data.item
    const photoId = e.currentTarget.dataset.id
    if (!item.id || !photoId) return
    wx.showModal({
      title: '删除照片',
      content: '确定删除这张照片吗？',
      success: (res: any) => {
        if (!res.confirm) return
        contentApi.deleteSpeciesPhoto(item.id, photoId)
          .then(() => {
            toast('已删除')
            this.loadPhotos(item.id)
          })
          .catch((err) => showError(err, '删除失败'))
      }
    })
  }
})
