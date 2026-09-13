import { DEFAULT_SPOT_ID } from '../../config/env'
import { homeApi, reminderApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError, toast, todayDate } from '../../utils/format'

/** 月份偏移，如 ('2026-09', -1) -> '2026-08' */
function shiftMonth(month: string, offset: number): string {
  const parts = month.split('-')
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MIN_MONTH = '2024-01'
const MAX_MONTH = '2027-12'

Page({
  // 已加载过的「地点+月份」结果，切回来直接渲染，不再转圈
  monthCache: {} as Record<string, Array<Array<any>>>,
  touchStartX: 0,
  touchStartY: 0,

  data: {
    spotId: DEFAULT_SPOT_ID,
    month: todayDate().slice(0, 7),
    monthText: '',
    weekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    loading: true,
    weeks: [] as Array<Array<any>>,
    // 提醒
    showRemind: false,
    reminding: false,
    selectedDate: '',
    remindTime: '08:00',
    reminders: [] as Array<any>
  },

  onLoad() {
    this.syncSpot()
    this.setData({ monthText: this.monthLabel(this.data.month) })
    this.load()
    this.loadReminders()
  },

  monthLabel(month: string): string {
    const parts = month.split('-')
    return `${parts[0]} 年 ${Number(parts[1])} 月`
  },

  /** 左右滑动切换月份 */
  onTouchStart(e: any) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    this.touchStartX = t.clientX
    this.touchStartY = t.clientY
  },

  onTouchEnd(e: any) {
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0])
    if (!t) return
    const dx = t.clientX - this.touchStartX
    const dy = t.clientY - this.touchStartY
    // 横向位移够大、且明显大于纵向（避免和页面滚动冲突）才判定为滑动
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    this.changeMonth(dx < 0 ? 1 : -1)
  },

  goPrevMonth() {
    this.changeMonth(-1)
  },

  goNextMonth() {
    this.changeMonth(1)
  },

  changeMonth(offset: number) {
    const next = shiftMonth(this.data.month, offset)
    if (next < MIN_MONTH || next > MAX_MONTH) {
      toast('已到可查看范围')
      return
    }
    this.setData({ month: next, monthText: this.monthLabel(next) })
    this.load()
  },

  onShow() {
    const prev = this.data.spotId
    this.syncSpot()
    if (this.data.spotId !== prev) this.load()
    // 可能是刚登录回来，刷新提醒列表
    this.loadReminders()
  },

  syncSpot() {
    const app = getApp()
    this.setData({
      spotId: (app.globalData && app.globalData.spotId) || DEFAULT_SPOT_ID
    })
  },

  onMonth(e: any) {
    const value = String(e.detail.value || this.data.month).slice(0, 7)
    this.setData({ month: value, monthText: this.monthLabel(value) })
    this.load()
  },

  load() {
    const key = `${this.data.spotId}|${this.data.month}`

    // 看过这个「地点+月份」：直接渲染，不转圈
    const hit = this.monthCache[key]
    if (hit) {
      this.setData({ loading: false, weeks: hit })
      return
    }

    this.setData({ loading: true, weeks: [] })
    homeApi.tideCalendar({ spotId: this.data.spotId, month: this.data.month })
      .then((data) => {
        const days = (data && (data.days || data.list)) || []
        const weeks = this.buildGrid(days.map((item: any) => ({
          date: item.date,
          lowText: (item.lowTimes || []).join(' / ') || '',
          highText: (item.highTimes || []).join(' / ') || '',
          observeHint: item.observeHint || ''
        })))
        this.monthCache[key] = weeks
        this.setData({ weeks })
      })
      .catch((err) => {
        this.apply([])
        showError(err, '潮汐日历加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  apply(days: any[]) {
    this.setData({ weeks: this.buildGrid(days) })
  },

  // ===== 提醒 =====
  loadReminders() {
    if (!isLoggedIn()) {
      this.setData({ reminders: [] })
      return
    }
    reminderApi.list()
      .then((data) => {
        const list = (data && data.list) || []
        this.setData({
          reminders: list.map((item: any) => ({
            id: item.id,
            dateText: String(item.remindAt || '').slice(0, 16).replace('T', ' '),
            timeText: String(item.remindAt || '').slice(11, 16),
            notifyText: String(item.notifyAt || '').slice(5, 16).replace('T', ' ')
          }))
        })
      })
      .catch(() => this.setData({ reminders: [] }))
  },

  /** 点某一天 → 打开设提醒面板 */
  onTapDay(e: any) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    if (!isLoggedIn()) {
      requireLogin()
      return
    }
    this.setData({ selectedDate: date, remindTime: '08:00', showRemind: true })
  },

  onRemindTime(e: any) {
    this.setData({ remindTime: e.detail.value })
  },

  closeRemind() {
    if (this.data.reminding) return
    this.setData({ showRemind: false })
  },

  confirmRemind() {
    if (this.data.reminding) return
    const remindAt = `${this.data.selectedDate}T${this.data.remindTime}`
    this.setData({ reminding: true })
    reminderApi.create({
      spotId: this.data.spotId,
      remindAt,
      note: '赶海提醒'
    })
      .then(() => {
        this.setData({ showRemind: false })
        toast('已设置提醒，提前 1 小时通知')
        this.loadReminders()
      })
      .catch((err) => showError(err, '设置提醒失败'))
      .finally(() => this.setData({ reminding: false }))
  },

  onDeleteReminder(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.showModal({
      title: '取消提醒',
      content: '确定取消这条提醒吗？',
      success: (res) => {
        if (!res.confirm) return
        reminderApi.remove(id)
          .then(() => {
            toast('已取消')
            this.loadReminders()
          })
          .catch((err) => showError(err, '取消失败'))
      }
    })
  },

  noop() {},

  buildGrid(days: any[]) {
    const [year, mon] = this.data.month.split('-').map((n) => Number(n))
    const total = new Date(year, mon, 0).getDate()
    const firstWeekday = new Date(year, mon - 1, 1).getDay() // 0=周日
    const today = todayDate()
    const map: Record<string, any> = {}
    days.forEach((d: any) => {
      map[d.date] = d
    })

    const cells: Array<any> = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= total; d++) {
      const date = `${this.data.month}-${String(d).padStart(2, '0')}`
      const info = map[date] || {}
      cells.push({
        day: d,
        date,
        lowText: info.lowText || '',
        highText: info.highText || '',
        observeHint: info.observeHint || '',
        isToday: date === today
      })
    }
    while (cells.length % 7 !== 0) cells.push(null)

    const weeks: Array<Array<any>> = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return weeks
  }
})
