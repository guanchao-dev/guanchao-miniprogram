import { contentApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { mediaUrl, preloadImage } from '../../utils/upload'

Page({
  data: {
    loading: true,
    item: {},
    akaText: '',
    coverUrl: '',
    coverSrc: ''
  },

  onLoad(query: any) {
    const id = (query && query.id) || ''
    if (!id) {
      this.setData({ loading: false })
      return
    }
    this.load(id)
  },

  load(id: string) {
    this.setData({ loading: true, item: {}, coverSrc: '' })
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
        // 打开这个物种的详情才算「看过」—— 图鉴列表不再一渲染就标记
        // （原因见 wiki.ts）。标记只影响闪光与 NEW 角标，失败不影响详情展示。
        contentApi.markSpeciesSeen([id]).catch(() => {})
      })
      .catch((err) => showError(err, '图鉴加载失败'))
      .finally(() => this.setData({ loading: false }))
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

  onPreviewPhoto(e: any) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ current: url, urls: [url] })
  }
})
