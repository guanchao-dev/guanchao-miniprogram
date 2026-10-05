import { contentApi } from '../../services/api'
import { toast, showError } from '../../utils/format'

Page({
  data: {
    name: '',
    address: '',
    lat: 0,
    lng: 0,
    note: '',
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

  async submit() {
    if (!this.data.canSubmit || this.data.submitting) return
    this.setData({ submitting: true })
    const payload = {
      name: this.data.name,
      address: this.data.address,
      lat: this.data.lat,
      lng: this.data.lng,
      note: this.data.note
    }
    try {
      // 不再往本地缓存写副本：服务端是唯一数据源。
      // 写副本会让「我的点位」出现重复卡片，而且那份副本删不掉，变成幽灵点位。
      await contentApi.createSpot(payload)
      toast('点位上传成功')
      setTimeout(() => wx.navigateBack(), 600)
    } catch (err) {
      showError(err, '提交失败')
    } finally {
      this.setData({ submitting: false })
    }
  }
})
