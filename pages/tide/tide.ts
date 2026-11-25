import { aiApi, homeApi, watchApi } from '../../services/api'
import { nowISO, todayDate, toast, trendText } from '../../utils/format'
import { requireLogin } from '../../utils/auth'
import { saveSpotId } from '../../utils/region'
import { loadGuideSpots, nearestGuideSpot } from '../../utils/spotGuide'
import { drawTideChart, normalizeTidePoints, TidePoint } from '../../utils/tideChart'
import { enableShareMenu } from '../../utils/share'
import { isWatching, setWatchSessionId, startWatchSession } from '../../utils/watchLog'
import { endWatchNow, notifyWatchBall, subscribeWatchBall } from '../../utils/watchBall'

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

type Extreme = { kind: '满潮' | '干潮'; time: string; heightM: number }

function extremePoints(points: TidePoint[]): Extreme[] {
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
    return { kind: kind as '满潮' | '干潮', time: item.time, heightM: item.heightM }
  })
}

function extremeRows(points: TidePoint[]) {
  return extremePoints(points).map((item) => ({
    kind: item.kind,
    time: item.time,
    height: `${item.heightM}m`
  }))
}

function toMin(time: string): number {
  const parts = String(time).split(':')
  return Number(parts[0]) * 60 + Number(parts[1] || 0)
}

function fromMin(min: number): string {
  const v = ((Math.round(min) % 1440) + 1440) % 1440
  return `${pad(Math.floor(v / 60))}:${pad(v % 60)}`
}

/** 潮差判定潮型：0.5m 微潮、1.5m 小潮、2.5m 中潮，更大为大潮 */
function tideTypeOf(range: number): string {
  if (range < 0.5) return '微潮'
  if (range < 1.5) return '小潮'
  if (range < 2.5) return '中潮'
  return '大潮'
}

/** 潮差大是活汛（中潮 / 大潮），潮差小是死汛（小潮 / 微潮） */
function tideSeasonOf(type: string): string {
  return type === '大潮' || type === '中潮' ? '活汛' : '死汛'
}

/** 最佳赶海时段：干潮前 2 小时到干潮后 1 小时；今天取离当前时间最近的一次干潮 */
function bestWindowOf(extremes: Extreme[], date: string): string {
  const lows = extremes.filter((item) => item.kind === '干潮')
  if (!lows.length) return ''
  let target = lows[0]
  if (date === todayDate()) {
    const now = new Date()
    const current = now.getHours() * 60 + now.getMinutes()
    target = lows.reduce((best, item) => (
      Math.abs(toMin(item.time) - current) < Math.abs(toMin(best.time) - current) ? item : best
    ), lows[0])
  }
  const low = toMin(target.time)
  return `${fromMin(low - 120)}-${fromMin(low + 60)}`
}

Page({
  chartReady: false,
  tidePoints: [] as TidePoint[],
  currentHeightM: undefined as number | undefined,
  pendingSpotId: '',
  clockTimer: 0 as any,
  swipeStartX: 0,
  swipeStartY: 0,
  // 日期条内的触摸不参与页面左滑，避免横滑日期时误跳日历
  stripTouching: false,
  // 潮汐请求序号：快速切日期时丢弃过期响应
  tideSeq: 0,
  _unsubWatch: null as (() => void) | null,
  // 本页已加载过的「地点+日期」结果，切换回来看过的直接渲染，不再转圈
  tideCache: {} as Record<string, { points: TidePoint[], view: Record<string, any>, currentHeightM?: number }>,
  // 出门建议按「地点+日期」缓存，重复查看不再请求 AI
  adviceCache: {} as Record<string, any>,
  // 已成功加载建议的「地点+日期」，避免重复请求
  adviceKeyLoaded: '',

  data: {
    loading: true,
    spots: [],
    spotNames: [],
    spotIndex: 0,
    spotId: '',
    spotName: '赶海点',
    date: todayDate(),
    dates: buildDates(todayDate()),
    heightText: '--',
    // 曲线画到 canvas 后导出成图片，再销毁画布：原生 canvas 不会盖住悬浮球
    chartImage: '',
    chartCanvas: true,
    trendText: '潮汐变化中',
    weather: {},
    table: [],
    phases: [],
    tideType: '',
    tideSeason: '',
    bestWindow: '',
    advice: {} as any,
    adviceLoaded: false,
    adviceLoading: false,
    // 开始 / 结束赶海：从首页移到潮汐表，直接以当前点位开始计时
    watchLabel: '开始赶海',
    watchClass: ''
  },

  onReady() {
    this.chartReady = true
    this.renderChart()
  },

  onShow() {
    this.startClock()
    this.syncWatchBtn()
  },

  onHide() {
    this.stopClock()
  },

  onUnload() {
    this.stopClock()
    const self = this as any
    if (self._unsubWatch) {
      self._unsubWatch()
      self._unsubWatch = null
    }
  },

  /** 页面停留时每分钟重画曲线，让「现在」横线跟着走 */
  startClock() {
    this.stopClock()
    this.clockTimer = setInterval(() => {
      this.renderChart()
    }, 60000)
  },

  stopClock() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer)
      this.clockTimer = 0
    }
  },

  onLoad(options: any) {
    enableShareMenu()
    // 悬浮球结束赶海后，本页按钮同步回「开始赶海」
    const self = this as any
    if (!self._unsubWatch) {
      self._lastWatching = isWatching()
      self._unsubWatch = subscribeWatchBall((state: any) => {
        if (state.watching === self._lastWatching) return
        self._lastWatching = state.watching
        this.syncWatchBtn()
      })
    }
    // 从赶海地图点标记进来：直接定位到该点位
    this.pendingSpotId = String((options && options.spotId) || '')
    this.setData({
      loading: true,
      dates: buildDates(this.data.date)
    })
    // 指定了点位就不必再申请定位；没指定时用定位找最近的赶海点
    loadGuideSpots(!!this.pendingSpotId)
      .then((list) => {
        const spots = list || []
        const pending = this.pendingSpotId
          ? spots.find((item) => item.id === this.pendingSpotId)
          : null
        const next = pending || nearestGuideSpot(spots) || spots[0]
        const index = next ? spots.findIndex((item) => item.id === next.id) : 0
        this.setData({
          spots,
          spotNames: spots.map((item) => item.name),
          spotIndex: index < 0 ? 0 : index
        })
        if (next) this.applySpot(next, !pending)
      })
      .catch(() => {})
      .finally(() => this.setData({ loading: false }))
  },

  onShareAppMessage() {
    return { title: '追潮记 · 今日潮汐', path: '/pages/tide/tide' }
  },

  /** 教学入口：进入使用教学页 */
  goTutorial() {
    wx.navigateTo({ url: '/pages/tutorial/tutorial' })
  },

  onSwipeStart(e: any) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    this.swipeStartX = t.clientX
    this.swipeStartY = t.clientY
  },

  /** 左滑进入潮汐日历（右滑不处理，避免误触返回） */
  onSwipeEnd(e: any) {
    if (this.stripTouching) return
    const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0])
    if (!t) return
    const dx = t.clientX - this.swipeStartX
    const dy = t.clientY - this.swipeStartY
    if (dx > -80 || Math.abs(dy) > 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    wx.navigateTo({ url: '/pages/calendar/calendar' })
  },

  /** 日期条触摸标记：日期条内部横滑只滚动日期，不触发整页左滑 */
  onStripTouchStart() {
    this.stripTouching = true
  },

  onStripTouchEnd() {
    // 等页面级 touchend 执行完再复位，保证本次手势不会被判定为左滑
    setTimeout(() => { this.stripTouching = false }, 80)
  },

  syncWatchBtn() {
    const watching = isWatching()
    this.setData({
      watchLabel: watching ? '结束赶海' : '开始赶海',
      watchClass: watching ? 'is-on' : ''
    })
  },

  /** 潮汐表页开始 / 结束赶海：直接用当前展示的点位开始计时 */
  onWatchToggle() {
    if (isWatching()) {
      wx.showModal({
        title: '结束赶海',
        content: '确认结束这次赶海吗？起止时间会写入赶海记录。',
        confirmText: '结束',
        cancelText: '继续',
        success: (res) => {
          if (!res.confirm) return
          const record = endWatchNow()
          toast(record ? '已记入赶海记录' : '没有进行中的赶海')
          this.syncWatchBtn()
        }
      })
      return
    }
    // 开始赶海要写服务端记录，后端要求登录
    if (!requireLogin()) return
    this.beginWatchAtSpot()
  },

  /** 用当前潮汐表对应的点位开始赶海 */
  beginWatchAtSpot() {
    const spot = (this.data.spots as any[])[this.data.spotIndex] || null
    const spotId = (spot && spot.id) || this.data.spotId
    const name = (spot && spot.name) || this.data.spotName
    if (!spotId) {
      toast('请先选择一个赶海点')
      return
    }
    const startedAt = nowISO()
    startWatchSession(startedAt, undefined, {
      spotId,
      name,
      latitude: spot ? spot.latitude : undefined,
      longitude: spot ? spot.longitude : undefined,
      source: 'recommend'
    })
    notifyWatchBall()
    this.syncWatchBtn()
    toast(`已在${name}开始赶海`)
    watchApi.start({
      startedAt,
      spotId,
      spotName: name,
      latitude: spot ? spot.latitude : undefined,
      longitude: spot ? spot.longitude : undefined,
      spotSource: 'recommend'
    })
      .then((data) => {
        if (data && data.id) setWatchSessionId(data.id)
      })
      .catch(() => {})
  },

  applySpot(spot: any, notify: boolean) {
    if (!spot) return
    saveSpotId(spot.id)
    const app = getApp()
    if (app && app.globalData) app.globalData.spotId = spot.id
    this.setData({
      spotId: spot.id,
      spotName: spot.name
    })
    this.resetAdvice()
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
    this.resetAdvice()
    this.loadTide()
  },

  loadTide() {
    if (!this.data.spotId) return
    const key = `${this.data.spotId}|${this.data.date}`
    // 连续点日期时，只认最后一次请求的结果，避免旧响应把新日期覆盖回去
    const seq = ++this.tideSeq

    // 已经看过这个「地点+日期」：直接渲染，不转圈
    const hit = this.tideCache[key]
    if (hit) {
      this.applyTide(hit.points, hit.view, hit.currentHeightM)
      return
    }

    // 不转圈、不清空：保留当前显示的数据，等新数据回来再整体替换
    // withAdvice=0：出门建议由本页单独向 AI 请求，跳过服务端预生成，快 1~2 秒
    homeApi.today({ spotId: this.data.spotId, date: this.data.date, withAdvice: 0 })
      .then((data) => {
        if (seq !== this.tideSeq) return
        const tide = (data && data.tide) || {}
        const weather = (data && data.weather) || {}
        const points = normalizeTidePoints(tide.hourly && tide.hourly.length ? tide.hourly : (tide.points || []))
        const extremes = extremePoints(points)

        // 潮型 / 汛期：优先后端字段，缺失时按当日潮差推导
        const heights = points.map((item) => item.heightM)
        const range = heights.length ? Math.max.apply(null, heights) - Math.min.apply(null, heights) : 0
        const tideType = points.length
          ? (String(tide.tideType || tide.tideName || '') || tideTypeOf(range))
          : ''
        let tideSeason = ''
        if (typeof tide.spring === 'boolean') {
          tideSeason = tide.spring ? '活汛' : '死汛'
        } else {
          tideSeason = String(tide.spring || tide.season || tide.tideSeason || '')
        }
        if (!tideSeason && tideType) tideSeason = tideSeasonOf(tideType)

        const bestWindow = (tide.bestTimeFrom && tide.bestTimeTo)
          ? `${tide.bestTimeFrom}-${tide.bestTimeTo}`
          : bestWindowOf(extremes, this.data.date)

        const currentHeightM = tide.currentHeightM != null && !Number.isNaN(Number(tide.currentHeightM))
          ? Number(tide.currentHeightM)
          : undefined

        const view = {
          heightText: tide.currentHeightM != null ? `${tide.currentHeightM}m` : '--',
          trendText: trendText(tide.trend),
          weather,
          tideType,
          tideSeason,
          bestWindow,
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
        this.tideCache[key] = { points, view, currentHeightM }
        this.applyTide(points, view, currentHeightM)
      })
      .catch(() => {
        // 请求失败：保持原有显示不变，等用户重试
      })
  },

  applyTide(points: TidePoint[], view: Record<string, any>, currentHeightM?: number) {
    this.tidePoints = points
    this.currentHeightM = currentHeightM
    this.setData(view, () => {
      this.renderChart()
      // 出门建议随潮汐数据自动获取，不需要用户再点按钮
      this.loadAdvice()
    })
  },

  /** 当前时间在整条潮汐曲线上的位置（仅当天有值） */
  nowRatio(): number | undefined {
    const points = this.tidePoints
    if (!points.length) return undefined
    // 接口数据以 00:00 开始、次日 00:00 结束，终点要展开成 1440 分钟
    const times: number[] = []
    points.forEach((item, i) => {
      let value = toMin(item.time)
      if (i > 0) {
        while (value < times[i - 1]) value += 1440
      }
      times.push(value)
    })
    const first = times[0]
    const last = times[times.length - 1]
    if (!(last > first)) return undefined
    const now = new Date()
    let current = now.getHours() * 60 + now.getMinutes()
    while (current < first) current += 1440
    if (current > last) return undefined
    return (current - first) / (last - first)
  },

  renderChart() {
    if (!this.chartReady || !this.tidePoints.length) return
    // 画布导出后会被销毁；重画时先挂回画布，等节点渲染完再绘制
    if (!this.data.chartCanvas) {
      this.setData({ chartCanvas: true, chartImage: '' }, () => {
        wx.nextTick(() => this.drawChartNow())
      })
      return
    }
    this.drawChartNow()
  },

  drawChartNow() {
    if (!this.chartReady || !this.tidePoints.length) return
    const isToday = this.data.date === todayDate()
    const points = this.tidePoints
    const parts = String(this.data.bestWindow || '').split('-')
    let bestRange: { from: number, to: number } | undefined = parts.length === 2 && parts[0] && parts[1]
      ? { from: toMin(parts[0]), to: toMin(parts[1]) }
      : undefined
    // 后端没给最佳时段时，按曲线低谷自己算一段（干潮前 2 小时 ~ 后 1 小时），保证曲线有黄色段
    if (!bestRange && points.length > 2) {
      const lows: number[] = []
      for (let i = 1; i < points.length - 1; i++) {
        if (points[i].heightM <= points[i - 1].heightM && points[i].heightM <= points[i + 1].heightM) {
          lows.push(toMin(points[i].time))
        }
      }
      if (lows.length) {
        let target = lows[0]
        if (isToday) {
          const now = new Date()
          const current = now.getHours() * 60 + now.getMinutes()
          target = lows.reduce((best, item) => (
            Math.abs(item - current) < Math.abs(best - current) ? item : best
          ), lows[0])
        }
        bestRange = { from: (target - 120 + 1440) % 1440, to: (target + 60) % 1440 }
      }
    }
    drawTideChart(
      this,
      this.tidePoints,
      isToday ? this.currentHeightM : undefined,
      {
        nowRatio: isToday ? this.nowRatio() : undefined,
        bestRange,
        exportImage: true
      }
    )
  },

  resetAdvice() {
    this.setData({ advice: {}, adviceLoaded: false, adviceLoading: false })
  },

  /** 获取当前点位当天的出门建议，结果按地点+日期缓存 */
  loadAdvice() {
    const key = `${this.data.spotId}|${this.data.date}`
    if (!this.data.spotId) return
    // 同一「地点+日期」已经拿到过结果，不重复请求
    if (this.adviceKeyLoaded === key && this.data.adviceLoaded) return
    const cached = this.adviceCache[key]
    if (cached) {
      this.adviceKeyLoaded = key
      this.setData({ advice: cached, adviceLoaded: true, adviceLoading: false })
      return
    }
    this.setData({ adviceLoading: true })
    aiApi.tideAdvice(undefined, undefined, this.data.date, this.data.spotId)
      .then((data) => {
        const advice = this.normalizeAdvice(data)
        this.adviceCache[key] = advice
        // 用户可能已经切到别的点位/日期，旧结果不要覆盖当前页面
        if (`${this.data.spotId}|${this.data.date}` !== key) return
        this.adviceKeyLoaded = key
        this.setData({ advice, adviceLoaded: true })
      })
      .catch(() => {
        // 失败时保持空态，不伪造赶海时机
      })
      .finally(() => {
        if (`${this.data.spotId}|${this.data.date}` === key) {
          this.setData({ adviceLoading: false })
        }
      })
  },

  normalizeAdvice(raw: any) {
    const suitable = (raw && raw.suitableNow) !== false
    const from = (raw && raw.bestTimeFrom) || ''
    const to = (raw && raw.bestTimeTo) || ''
    const spot = raw && raw.recommendedSpot
    const spots = spot ? [{
      id: spot.id || '',
      name: spot.name || '',
      distance: spot.distanceText || '',
      reason: spot.district ? spot.district : ''
    }] : []
    return {
      suitableNow: suitable,
      verdict: suitable ? (from ? `${from} 适合赶海` : '今天适合赶海') : '目前不适合赶海',
      bestWindow: from && to ? `${from}-${to}` : '',
      leaveBefore: to || '',
      recommendedSpots: spots,
      headline: (raw && raw.headline) || '',
      body: (raw && raw.body) || ''
    }
  },

  onAdviceSpot(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${id}` })
  }
})
