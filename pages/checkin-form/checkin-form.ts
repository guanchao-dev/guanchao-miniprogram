import { contentApi } from '../../services/api'
import { nowISO, showError, toast } from '../../utils/format'

const GRID = 0.003 // 约300米，坐标按此网格取整后再提交

Page({
  data: {
    name: '',
    studentNo: '',
    locating: false,
    located: false,
    lat: 0,
    lng: 0,
    submitting: false
  },

  onName(e: any) {
    this.setData({ name: e.detail.value || '' })
  },

  onStudentNo(e: any) {
    this.setData({ studentNo: e.detail.value || '' })
  },

  /** 获取定位：坐标按约300米网格取整，只上报粗粒度位置 */
  locate() {
    if (this.data.locating) return
    this.setData({ locating: true })
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          located: true,
          locating: false,
          lat: Math.round(res.latitude / GRID) * GRID,
          lng: Math.round(res.longitude / GRID) * GRID
        })
      },
      fail: () => {
        this.setData({ locating: false })
        toast('定位失败，请检查定位权限')
      }
    })
  },

  onSubmit() {
    if (this.data.submitting) return
    const name = (this.data.name || '').trim()
    const studentNo = (this.data.studentNo || '').trim()
    if (!name) {
      toast('请填写姓名')
      return
    }
    if (!studentNo) {
      toast('请填写学号')
      return
    }
    if (!this.data.located) {
      toast('请先获取当前位置')
      return
    }
    this.setData({ submitting: true })
    contentApi.checkin({
      name,
      studentNo,
      lat: this.data.lat,
      lng: this.data.lng,
      checkinAt: nowISO()
    })
      .then(() => {
        toast('签到成功')
        setTimeout(() => wx.navigateBack({ delta: 1 }), 600)
      })
      .catch((err) => {
        this.setData({ submitting: false })
        showError(err, '签到失败')
      })
  }
})
