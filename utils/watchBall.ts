import { endWatchSession, getWatchSession, isWatching } from './watchLog'
import { nowISO } from './format'
import { watchApi } from '../services/api'

/**
 * 全局悬浮球状态：模块级单例计时器 + 监听器。
 * 页面/组件只负责渲染，观潮状态与计时统一在这里维护，
 * 跨页面、切后台、重进小程序都能续上，直到结束观潮。
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

/** 观潮开始/结束时调用：所有页面的悬浮球同步显示/隐藏 */
export function notifyWatchBall() {
  if (isWatching()) startTimer()
  else stopTimer()
  emit()
}

/** 结束观潮：本地落记录 + 同步服务端，全局复位（按钮与悬浮球共用） */
export function endWatchNow(): any {
  const session = getWatchSession()
  const endedAt = nowISO()
  const record = endWatchSession(endedAt)
  if (session && session.id && record) {
    watchApi.end(session.id, {
      endedAt,
      species: record.species
    }).catch(() => {})
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
  if (!pos) {
    const m = getBallMetrics()
    pos = {
      left: m.winW - m.ballSize - m.ballMargin,
      top: m.winH - m.ballSize - Math.round(220 * (m.ballSize / 150))
    }
  }
  return pos
}

export function setBallPos(left: number, top: number) {
  pos = { left, top }
}
