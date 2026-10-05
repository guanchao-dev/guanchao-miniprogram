import { contentApi } from '../../services/api'
import { toast, showError } from '../../utils/format'
import { chooseImages, uploadImage } from '../../utils/upload'

/** 现场照片上限 */
const MAX_PHOTOS = 3

Page({
  data: {
    name: '',
    address: '',
    lat: 0,
    lng: 0,
    note: '',
    photos: [] as string[],
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

  /** 选照片：一次最多补到 3 张 */
  choosePhotos() {
    const remain = MAX_PHOTOS - this.data.photos.length
    if (remain <= 0) return
    chooseImages(remain)
      .then((list) => {
        const photos = this.data.photos.concat(list).slice(0, MAX_PHOTOS)
        this.setData({ photos })
      })
      .catch((err) => {
        if (err && err.message === 'cancel') return
        showError(err, '选择照片失败')
      })
  },

  removePhoto(e: any) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ photos: this.data.photos.filter((item, i) => i !== index) })
  },

  previewPhoto(e: any) {
    const url = this.data.photos[Number(e.currentTarget.dataset.index)]
    if (!url) return
    wx.previewImage({ urls: this.data.photos, current: url })
  },

  refreshCanSubmit() {
    const ok = !!(this.data.name && this.data.lat && this.data.lng)
    this.setData({ canSubmit: ok })
  },

  async submit() {
    if (!this.data.canSubmit || this.data.submitting) return
    this.setData({ submitting: true })
    wx.showLoading({ title: '上传中', mask: true })
    try {
      // 照片先传成 uploadId，再由 /spots 关联到点位（1~3 张）
      const photoIds = await Promise.all(
        this.data.photos.map((path) => uploadImage('observation', path))
      )
      const payload: Record<string, any> = {
        name: this.data.name,
        address: this.data.address,
        lat: this.data.lat,
        lng: this.data.lng,
        note: this.data.note
      }
      if (photoIds.length) payload.photoIds = photoIds
      // 不再往本地缓存写副本：服务端是唯一数据源。
      // 写副本会让「我的点位」出现重复卡片，而且那份副本删不掉，变成幽灵点位。
      await contentApi.createSpot(payload)
      // 先关 loading 再弹提示：两者共用同一个原生视图，反过来的话会互相顶掉
      wx.hideLoading()
      toast('点位上传成功')
      setTimeout(() => wx.navigateBack(), 600)
    } catch (err) {
      wx.hideLoading()
      showError(err, '提交失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
