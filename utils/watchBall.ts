import { endWatchSession, getWatchSession, isWatching, removeWatchRecord } from './watchLog'
import { nowISO } from './format'
import { isLoggedIn } from './auth'
import { spotVisitApi, watchApi } from '../services/api'

/**
 * 全局悬浮球状态：模块级单例计时器 + 监听器。
 * 页面/组件只负责渲染，赶海状态与计时统一在这里维护，
 * 跨页面、切后台、重进小程序都能续上，直到结束赶海。
 */
export interface WatchBallState {
  watching: boolean
  duration: string
}

type Listener = (state: WatchBallState) => void

let timer: number | null = null
let startMs = 0
const listeners = new Set<Listener>()

let metrics: { winW: number; winH: number; ballSize: number; ballMargin: number } | null = null
let pos: { left: number; top: number } | null = null

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

function emit() {
  const state: WatchBallState = {
    watching: isWatching(),
    duration: timer ? fmt(Date.now() - startMs) : '00:00'
  }
  listeners.forEach((fn) => fn(state))
}

function startTimer() {
  if (timer) return
  const session = getWatchSession()
  const t = new Date((session && session.startedAt) || nowISO()).getTime()
  startMs = Number.isNaN(t) ? Date.now() : t
  timer = setInterval(emit, 1000) as unknown as number
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/** 当前全局状态（页面 onShow 时主动拉一次，避免依赖上次回调） */
export function getWatchBallState(): WatchBallState {
  return { watching: isWatching(), duration: timer ? fmt(Date.now() - startMs) : '00:00' }
}

/** 订阅：订阅立即回调一次，之后每秒 tick 与状态变化都会回调；返回取消函数 */
export function subscribeWatchBall(fn: Listener): () => void {
  listeners.add(fn)
  if (isWatching()) startTimer()
  fn(getWatchBallState())
  return () => {
    listeners.delete(fn)
  }
}

/** 赶海开始/结束时调用：所有页面的悬浮球同步显示/隐藏 */
export function notifyWatchBall() {
  if (isWatching()) startTimer()
  else stopTimer()
  emit()
}

/** 结束赶海：本地落记录 + 同步服务端，全局复位（按钮与悬浮球共用） */
export function endWatchNow(): any {
  const session = getWatchSession()
  const endedAt = nowISO()
  const record = endWatchSession(endedAt)

  // 结束赶海即点亮所选推荐赶海点（账号维度）。接口幂等，同一点位只点亮一次；
  // 自选点位没有 spotId，不点亮；未登录不发送。
  const spotId = session && session.spot && session.spot.spotId
  if (spotId && isLoggedIn()) {
    spotVisitApi.light(spotId, { sessionId: (session && session.id) || '', visitedAt: endedAt }).catch(() => {})
  }

  if (session && session.id && record) {
    watchApi.end(session.id, {
      endedAt,
      species: record.species
    }).then(() => {
      // 服务端已经记下这次赶海 → 删掉本地那条，否则赶海记录里会重复显示两条
      removeWatchRecord(record.id)
      emit()
    }).catch(() => {
      // 失败就保留本地记录（无网时先存本地，有网再从服务端拉）
    })
  }
  stopTimer()
  emit()
  return record
}

export function getBallMetrics() {
  if (!metrics) {
    const info = wx.getSystemInfoSync()
    const scale = info.windowWidth / 750
    metrics = {
      winW: info.windowWidth,
      winH: info.windowHeight,
      ballSize: Math.round(150 * scale),
      ballMargin: Math.round(24 * scale)
    }
  }
  return metrics
}

/** 悬浮球位置全局共享：跨页面、跨拖拽保持一致，重启小程序才回默认 */
export function getBallPos() {
  const m = getBallMetrics()
  if (!pos) {
    pos = {
      left: m.winW - m.ballSize - m.ballMargin,
      top: m.winH - m.ballSize - Math.round(220 * (m.ballSize / 150))
    }
  }
  // 位置跨页面共享：换到窗口更小的页面（如带原生 TabBar 的页面）时，
  // 旧坐标可能落在底部 TabBar 下面，这里统一收回到可视区内。
  const maxLeft = Math.max(m.ballMargin, m.winW - m.ballSize - m.ballMargin)
  const maxTop = Math.max(m.ballMargin, m.winH - m.ballSize - m.ballMargin)
  pos.left = Math.min(Math.max(pos.left, m.ballMargin), maxLeft)
  pos.top = Math.min(Math.max(pos.top, m.ballMargin), maxTop)
  return pos
}

export function setBallPos(left: number, top: number) {
  pos = { left, top }
}
