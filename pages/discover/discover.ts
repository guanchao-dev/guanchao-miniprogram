import { BASE_URL, DEFAULT_SPOT_ID } from '../../config/env'
import { cardApi, homeApi } from '../../services/api'
import { isLoggedIn } from '../../utils/auth'
import { showError, toast, todayDate, nowTime, toISO, trendText } from '../../utils/format'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'
import { chooseImage, uploadImage } from '../../utils/upload'

Page({
  prefilled: false,

  data: {
    spotId: DEFAULT_SPOT_ID,
    place: '青岛 · 石老人',
    date: todayDate(),
    time: nowTime(),
    tideText: '',
    userNote: '',
    photoPath: '',
    submitting: false,
    card: {},
    coverSrc: '',
    aiGenerating: false,
    shareTitle: '我在观潮留下一张今日发现',
    sharePath: '/pages/home/home'
  },

  onLoad(query: any) {
    if (query && query.id) {
      this.loadCard(query.id)
      return
    }
    const app = getApp()
    const spotId = (query && query.spotId) || (app.globalData && app.globalData.spotId) || DEFAULT_SPOT_ID
    this.setData({ spotId })
  },

  onShow() {
    if (this.data.card && this.data.card.id) return
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    if (!this.prefilled) {
      this.prefilled = true
      this.prefill(this.data.spotId)
    }
  },

  prefill(spotId: string) {
    homeApi.today({ spotId })
      .then((data) => {
        const place = (data && data.place) || {}
        const tide = (data && data.tide) || {}
        const height = tide.currentHeightM
        const tideText = height != null
          ? `潮高 ${height} 米 · ${trendText(tide.trend)}`
          : '潮汐数据暂缺'
        this.setData({
          spotId: place.spotId || spotId,
          place: place.name || this.data.place,
          tideText
        })
      })
      .catch(() => {
        this.setData({ tideText: '潮汐数据暂缺' })
      })
  },

  loadCard(id: string) {
    cardApi.detail(id)
      .then((card) => {
        this.showCard(card, '')
        if (card && card.id && !card.aiImageReady) {
          this.pollAiCover(card.id)
        }
      })
      .catch((err) => showError(err, '图鉴卡加载失败'))
  },

  showCard(card: any, localPhoto: string) {
    this.setData({
      card: card || {},
      aiGenerating: !!(card && card.id && !card.aiImageReady),
      shareTitle: card && card.title ? `我在观潮留下一张「${card.title}」` : '我在观潮留下一张今日发现',
      sharePath: card && card.id ? `/pages/discover/discover?id=${card.id}` : '/pages/home/home'
    })
    if (card && card.aiImageReady && card.coverUrl) {
      this.downloadCover(BASE_URL + card.coverUrl)
    } else {
      this.setData({ coverSrc: '' })
    }
  },

  downloadCover(url: string) {
    wx.downloadFile({
      url,
      success: (res: any) => {
        if (res.statusCode === 200 && res.tempFilePath) {
          this.setData({ coverSrc: res.tempFilePath, aiGenerating: false })
        }
      },
      fail: () => {}
    })
  },

  choosePhoto() {
    chooseImage()
      .then((photoPath) => this.setData({ photoPath }))
      .catch((err) => {
        if (err && err.message === 'cancel') return
        showError(err, '选择照片失败')
      })
  },

  onDate(e: any) {
    this.setData({ date: e.detail.value })
  },

  onTime(e: any) {
    this.setData({ time: e.detail.value })
  },

  onTide(e: any) {
    this.setData({ tideText: e.detail.value })
  },

  onNote(e: any) {
    this.setData({ userNote: e.detail.value })
  },

  onSubmit() {
    if (this.data.submitting) return
    if (!this.data.photoPath) {
      toast('请先选择照片')
      return
    }
    this.setData({ submitting: true })
    wx.showLoading({ title: '生成卡片', mask: true })
    uploadImage('card', this.data.photoPath)
      .then((uploadId) => {
        const noteParts = []
        if (this.data.tideText) noteParts.push(this.data.tideText)
        if (this.data.userNote) noteParts.push(this.data.userNote)
        return cardApi.create({
          uploadId,
          spotId: this.data.spotId,
          observedAt: toISO(this.data.date, this.data.time),
          userNote: noteParts.join('；')
        })
      })
      .then((card) => {
        this.showCard(card, this.data.photoPath)
        enqueueUnlocks((card && card.unlockedMedalIds) || [], 'card')
        flushUnlocks(this)
        if (card && card.id && !card.aiImageReady) {
          this.pollAiCover(card.id)
        }
      })
      .catch((err) => showError(err, '生成图鉴卡失败'))
      .finally(() => {
        this.setData({ submitting: false })
        wx.hideLoading()
      })
  },

  pollAiCover(cardId: string) {
    let tries = 0
    const timer = setInterval(() => {
      tries++
      cardApi.detail(cardId)
        .then((card) => {
          if (card && card.aiImageReady && card.coverUrl) {
            clearInterval(timer)
            this.setData({ card: card })
            this.downloadCover(BASE_URL + card.coverUrl + '?ai=1')
          } else if (tries >= 20) {
            clearInterval(timer)
            // 超时兜底：生图失败时退回显示原照片，避免一直等待
            this.setData({ aiGenerating: false })
            if (card && card.coverUrl) {
              this.downloadCover(BASE_URL + card.coverUrl)
            }
          }
        })
        .catch(() => {
          if (tries >= 20) {
            clearInterval(timer)
            this.setData({ aiGenerating: false })
          }
        })
    }, 3000)
  },

  onFavorite() {
    const card: any = this.data.card
    if (!card || !card.id) return
    const req = card.favorited ? cardApi.unfavorite(card.id) : cardApi.favorite(card.id)
    req.then(() => {
      this.setData({ 'card.favorited': !card.favorited })
      toast(card.favorited ? '已取消收藏' : '已收藏')
    }).catch((err) => showError(err, '收藏失败'))
  },

  onShare() {
    const card: any = this.data.card
    if (!card || !card.id) return
    cardApi.share(card.id, 'wechatFriend')
      .then((data) => {
        if (data && data.copyText) {
          wx.setClipboardData({ data: data.copyText })
        }
        if (data && data.title) this.setData({ shareTitle: data.title })
        toast('文案已复制，可转发给好友')
      })
      .catch((err) => showError(err, '分享失败'))
  },

  onShareAppMessage() {
    return {
      title: this.data.shareTitle,
      path: this.data.sharePath
    }
  }
})
