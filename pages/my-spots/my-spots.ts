import { contentApi } from '../../services/api'
import { toast, showError } from '../../utils/format'
import { mediaUrl } from '../../utils/upload'
import { loadSpots, removeSpot, TreasureSpot } from '../../utils/spotStore'
import { openSpotMap, copyAmapLink } from '../../utils/amapNav'

interface ListItem {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  note: string
  photoUrl: string
  createdAt: string
}

Page({
  data: {
    loading: true,
    list: [] as ListItem[],
    empty: false
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    this.setData({ loading: true })
    // 先读本地缓存做秒开
    const local = loadSpots()
    this.applyList(local)
    // 再尝试后端接口
    try {
      const res = await contentApi.mySpots()
      const remote: ListItem[] = (res.list || []).map((item: any) => ({
        id: String(item.id || ''),
        name: item.name || '',
        address: item.address || '',
        lat: Number(item.lat || item.latitude || 0),
        lng: Number(item.lng || item.longitude || 0),
        note: item.note || '',
        photoUrl: mediaUrl(item.photoUrl || item.photo || ''),
        createdAt: item.createdAt || ''
      })).filter((it) => it.id)
      // 后端有数据就用后端的；否则保留本地缓存
      if (remote.length) {
        this.applyList(remote)
      } else {
        this.applyList(local)
      }
    } catch (err) {
      // 兜底：接口失败时仍展示本地
      this.applyList(local)
    } finally {
      this.setData({ loading: false })
    }
  },

  applyList(spots: TreasureSpot[]) {
    const list: ListItem[] = spots.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      note: s.note || '',
      photoUrl: s.photoUrl || '',
      createdAt: s.createdAt
    }))
    this.setData({ list, empty: list.length === 0 })
  },

  goShare() {
    wx.navigateTo({ url: '/pages/spot-share/spot-share' })
  },

  onNavigate(e: any) {
    const idx = Number(e.currentTarget.dataset.index)
    const item = this.data.list[idx]
    if (!item) return
    openSpotMap(item.lat, item.lng, item.name, item.address)
  },

  onCopyAmap(e: any) {
    const idx = Number(e.currentTarget.dataset.index)
    const item = this.data.list[idx]
    if (!item) return
    copyAmapLink(item.lat, item.lng, item.name)
  },

  onDelete(e: any) {
    const idx = Number(e.currentTarget.dataset.index)
    const item = this.data.list[idx]
    if (!item) return
    wx.showModal({
      title: '删除点位',
      content: `确认删除「${item.name}」？`,
      confirmColor: '#E0533D',
      success: (res) => {
        if (!res.confirm) return
        removeSpot(item.id)
        this.applyList(loadSpots())
        toast('已删除')
      }
    })
  }
})
