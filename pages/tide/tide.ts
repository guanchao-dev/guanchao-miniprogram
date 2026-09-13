import { homeApi } from '../../services/api'
import { nowTime, todayDate, trendText } from '../../utils/format'
import { loadGuideSpots, nearestGuideSpot } from '../../utils/spotGuide'
import { drawTideChart, normalizeTidePoints, TidePoint } from '../../utils/tideChart'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date.replace(/-/g, '/')} 12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function buildDates(center: string) {
  const out = []
  for (let i = -3; i <= 3; i++) {
    const date = shiftDate(center, i)
    const d = new Date(`${date.replace(/-/g, '/')} 12:00:00`)
    out.push({
      date,
      day: Number(date.slice(8)),
      week: WEEK[d.getDay()],
      current: i === 0
    })
  }
  return out
}

function tideLabel(type?: string): string {
  if (type === 'high') return '满潮'
  if (type === 'low') return '干潮'
  return ''
}

function extremeRows(points: TidePoint[]) {
  const tagged = points.filter((item) => item.type === 'high' || item.type === 'low')
  const src = tagged.length
    ? tagged
    : points.filter((item, i) => {
      if (i === 0 || i === points.length - 1) return false
      const prev = points[i - 1].heightM
      const cur = item.heightM
      const next = points[i + 1].heightM
      return (cur > prev && cur >= next) || (cur < prev && cur <= next)
    })
  return src.map((item, i, arr) => {
    let kind = tideLabel(item.type)
    if (!kind) {
      const prev = arr[i - 1] ? arr[i - 1].heightM : item.heightM - 1
      kind = item.heightM >= prev ? '满潮' : '干潮'
    }
    return { kind, time: item.time, height: `${item.heightM}m` }
  })
}

Page({
  chartReady: false,
  tidePoints: [] as TidePoint[],
  // 本页已加载过的「地点+日期」结果，切换回来看过的直接渲染，不再转圈
  tideCache: {} as Record<string, { points: TidePoint[], view: Record<string, any> }>,

  data: {
    loading: true,
    spots: [],
    spotNames: [],
    spotIndex: 0,
    spotId: '',
    spotName: '赶海点',
    date: todayDate(),
    dates: buildDates(todayDate()),
    now: nowTime(),
    heightText: '--',
    trendText: '潮汐变化中',
    weather: {},
    table: [],
    phases: []
  },

  onReady() {
    this.chartReady = true
    this.renderChart()
  },

  onLoad() {
    this.setData({
      loading: true,
      dates: buildDates(this.data.date)
    })
    loadGuideSpots()
      .then((list) => {
        const spots = list || []
        const next = nearestGuideSpot(spots) || spots[0]
        const index = next ? spots.findIndex((item) => item.id === next.id) : 0
        this.setData({
          spots,
          spotNames: spots.map((item) => item.name),
          spotIndex: index < 0 ? 0 : index
        })
        if (next) this.applySpot(next, true)
      })
      .catch(() => {})
      .finally(() => this.setData({ loading: false }))
  },

  applySpot(spot: any, notify: boolean) {
    if (!spot) return
    this.setData({
      spotId: spot.id,
      spotName: spot.name
    })
    if (notify) {
      wx.showModal({
        title: '潮汐表',
        content: `当前展示的是「${spot.name}」的潮汐表`,
        showCancel: false,
        confirmText: '知道了'
      })
    }
    this.loadTide()
  },

  onSpotChange(e: any) {
    const index = Number(e.detail.value)
    const spot = this.data.spots[index]
    if (!spot) return
    this.setData({ spotIndex: index })
    this.applySpot(spot, false)
    wx.showToast({ title: `已切换到${spot.name}`, icon: 'none' })
  },

  onPickDate(e: any) {
    const date = e.currentTarget.dataset.date
    if (!date || date === this.data.date) return
    this.setData({ date, dates: buildDates(date) })
    this.loadTide()
  },

  onPrevDay() {
    this.changeDay(-1)
  },

  onNextDay() {
    this.changeDay(1)
  },

  changeDay(offset: number) {
    const date = shiftDate(this.data.date, offset)
    this.setData({ date, dates: buildDates(date) })
    this.loadTide()
  },

  loadTide() {
    if (!this.data.spotId) return
    const key = `${this.data.spotId}|${this.data.date}`

    // 已经看过这个「地点+日期」：直接渲染，不转圈
    const hit = this.tideCache[key]
    if (hit) {
      this.applyTide(hit.points, hit.view)
      return
    }

    // 不转圈、不清空：保留当前显示的数据，等新数据回来再整体替换
    // withAdvice=0：潮汐表不展示出行建议，跳过服务端 AI 生成，快 1~2 秒
    homeApi.today({ spotId: this.data.spotId, date: this.data.date, withAdvice: 0 })
      .then((data) => {
        const tide = (data && data.tide) || {}
        const weather = (data && data.weather) || {}
        const points = normalizeTidePoints(tide.hourly && tide.hourly.length ? tide.hourly : (tide.points || []))
        const view = {
          now: nowTime(),
          heightText: tide.currentHeightM != null ? `${tide.currentHeightM}m` : '--',
          trendText: trendText(tide.trend),
          weather,
          table: extremeRows(points),
          phases: points.slice(0, -1).map((item, i) => {
            const next = points[i + 1]
            const rising = next.heightM > item.heightM
            return {
              range: `${item.time}-${next.time}`,
              label: rising ? '涨潮' : '退潮',
              rising,
              delta: `${item.heightM} → ${next.heightM}m`
            }
          })
        }
        this.tideCache[key] = { points, view }
        this.applyTide(points, view)
      })
      .catch(() => {
        // 请求失败：保持原有显示不变，等用户重试
      })
  },

  applyTide(points: TidePoint[], view: Record<string, any>) {
    this.tidePoints = points
    this.setData(view, () => this.renderChart())
  },

  renderChart() {
    if (!this.chartReady || !this.tidePoints.length) return
    drawTideChart(this, this.tidePoints)
  }
})
