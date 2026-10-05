import { contentApi } from '../../services/api'
import { toast, showError } from '../../utils/format'
import { chooseImages, uploadImage } from '../../utils/upload'

/** 一条投稿最多几张图（与后端 spots.py 的 _MAX_PHOTOS 一致） */
const MAX_PHOTOS = 3

Page({
  data: {
    name: '',
    address: '',
    lat: 0,
    lng: 0,
    note: '',
    // 选的图片（本地临时路径），提交时才逐张上传
    photos: [] as string[],
    maxPhotos: MAX_PHOTOS,
    mapLat: 36.06,
    mapLng: 120.38,
    markers: [] as any[],
    submitting: false,
    canSubmit: false
  },

  onInputName(e: any) {
    this.setData({ name: e.detail.value }, this.refreshCanSubmit)
  },
  onInputAddress(e: any) {
    this.setData({ address: e.detail.value }, this.refreshCanSubmit)
  },
  onInputNote(e: any) {
    this.setData({ note: e.detail.value })
  },

  /** 微信原生地图选点，参考 checkin-form.choosePlace */
  choosePlace() {
    wx.chooseLocation({
      success: (res: any) => {
        const markers = [{
          id: 1,
          latitude: res.latitude,
          longitude: res.longitude,
          width: 30,
          height: 30
        }]
        this.setData({
          name: this.data.name || res.name || '所选点位',
          address: res.address || '',
          lat: res.latitude,
          lng: res.longitude,
          mapLat: res.latitude,
          mapLng: res.longitude,
          markers
        }, this.refreshCanSubmit)
      },
      fail: (err: any) => {
        if (err && String(err.errMsg).indexOf('cancel') >= 0) return
        if (err && String(err.errMsg).indexOf('auth') >= 0) {
          toast('请先在设置里允许获取位置')
          return
        }
        toast('地图选点失败，请检查定位权限')
      }
    })
  },

  refreshCanSubmit() {
    const ok = !!(this.data.name && this.data.lat && this.data.lng)
    this.setData({ canSubmit: ok })
  },

  /* ===== 照片（选填，最多 3 张）===== */
  choosePhotos() {
    const left = MAX_PHOTOS - this.data.photos.length
    if (left <= 0) return
    chooseImages(left)
      .then((list) => {
        this.setData({ photos: this.data.photos.concat(list).slice(0, MAX_PHOTOS) })
      })
      .catch((err) => {
        if (err && err.message === 'cancel') return
        showError(err, '选择照片失败')
      })
  },

  removePhoto(e: any) {
    const idx = Number(e.currentTarget.dataset.index)
    const photos = this.data.photos.slice()
    photos.splice(idx, 1)
    this.setData({ photos })
  },

  previewPhoto(e: any) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ current: url, urls: this.data.photos })
  },

  async submit() {
    if (!this.data.canSubmit || this.data.submitting) return
    this.setData({ submitting: true })
    try {
      // 图片逐张上传换成 uploadId，服务端负责压缩和存储（COS）
      const uploadIds: string[] = []
      const total = this.data.photos.length
      for (let i = 0; i < total; i++) {
        wx.showLoading({ title: `上传图片 ${i + 1}/${total}`, mask: true })
        uploadIds.push(await uploadImage('spot', this.data.photos[i]))
      }
      wx.hideLoading()

      // 不再往本地缓存写副本：服务端是唯一数据源。
      // 写副本会让「我的点位」出现重复卡片，而且那份副本删不掉，变成幽灵点位。
      await contentApi.createSpot({
        name: this.data.name,
        address: this.data.address,
        lat: this.data.lat,
        lng: this.data.lng,
        note: this.data.note,
        photoUploadIds: uploadIds
      })
      toast('点位已保存')
      setTimeout(() => wx.navigateBack(), 600)
    } catch (err) {
      // showLoading 和 showToast 共用一个原生视图，不先 hide 的话提示会被盖住
      wx.hideLoading()
      showError(err, '提交失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
