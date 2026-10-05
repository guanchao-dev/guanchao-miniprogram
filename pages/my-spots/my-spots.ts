import { contentApi } from '../../services/api'
import { toast, showError } from '../../utils/format'
import { mediaUrl } from '../../utils/upload'
import { openSpotMap } from '../../utils/amapNav'

/** 「我的点位」条目：仅自己可见，可导航 / 删除 */
interface MineItem {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  note: string
  photoUrl: string
  createdAt: string
  status: string
  statusText: string
  reviewNote: string
}

/** 审核状态 -> 徽章文案。未知/缺失一律当「审核中」 */
const STATUS_TEXT: Record<string, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '未通过'
}

/** 早期版本写本地缓存用的 key（见 onLoad 的一次性清理） */
const LEGACY_STORE_KEY = 'my_treasure_spots'

function statusTextOf(status?: string): string {
  return STATUS_TEXT[status || 'pending'] || '审核中'
}

Page({
  data: {
    loading: true,
    showLoading: true,
    empty: true,
    mine: [] as MineItem[]
  },

  onLoad() {
    // 一次性清理历史遗留：早期版本会把上传的点位另存一份到本地（接口不通时的 mock 兜底）。
    // 那份副本 id 与后端不同、按 id 删不掉，一旦被当成数据源显示出来，
    // 用户就会看到「以前删掉的旧点位」。现在服务端是唯一数据源，把这份残留清掉。
    try {
      wx.removeStorageSync(LEGACY_STORE_KEY)
    } catch (e) {
      /* 清理失败不影响使用 */
    }
  },

  onShow() {
    this.loadMine()
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/spot-share/spot-share' })
  },

  /** 我的点位：自己记录过的点位，仅自己可见 */
  async loadMine() {
    this.setData({ loading: true, showLoading: !this.data.mine.length })
    try {
      const res = await contentApi.mySpots()
      const mine: MineItem[] = (res.list || []).map((item: any) => ({
        id: String(item.id || ''),
        name: item.name || '',
        address: item.address || '',
        lat: Number(item.lat || item.latitude || 0),
        lng: Number(item.lng || item.longitude || 0),
        note: item.note || '',
        photoUrl: mediaUrl(item.photoUrl || item.photo || ''),
        createdAt: item.createdAt || '',
        status: item.status || 'pending',
        statusText: statusTextOf(item.status),
        reviewNote: item.reviewNote || ''
      })).filter((it: MineItem) => it.id)
      this.setData({ mine, empty: mine.length === 0 })
    } catch (err) {
      // 接口失败如实报错，不再回退本地缓存 ——
      // 本地可能存着已删除的旧点位，顶上去会让用户以为删除没生效。
      showError(err, '点位加载失败')
      this.setData({ empty: this.data.mine.length === 0 })
    } finally {
      this.setData({ loading: false, showLoading: false })
    }
  },

  onNavigate(e: any) {
    const idx = Number(e.currentTarget.dataset.index)
    const item = this.data.mine[idx]
    if (!item) return
    openSpotMap(item.lat, item.lng, item.name, item.address)
  },

  onDelete(e: any) {
    const idx = Number(e.currentTarget.dataset.index)
    const item = this.data.mine[idx]
    if (!item) return
    wx.showModal({
      title: '删除点位',
      content: `确认删除「${item.name}」？`,
      confirmColor: '#E0533D',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await contentApi.deleteSpot(item.id)
        } catch (err) {
          // 必须服务端真删成功才从列表移除。以前这里把失败吞掉、照样提示「已删除」，
          // 结果退出重进点位又回来了（假删除），看起来就像「删掉的点位又出现」。
          showError(err, '删除失败，请重试')
          return
        }
        const mine = this.data.mine.filter((it: MineItem) => it.id !== item.id)
        this.setData({ mine, empty: mine.length === 0 })
        toast('已删除')
      }
    })
  }
})
