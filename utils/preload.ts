/**
 * 前端预加载：小程序启动时就和图片并行把二级页面数据请求好，写入 http 缓存。
 * 用户点进去时直接命中缓存，感知上「秒开」。
 *
 * 注意：
 * - 只跑一次（kicked 守卫）；
 * - 错峰发请求，避免瞬间打满微信 10 个并发上限；
 * - 不预加载会触发服务端 AI 的接口（如带 withAdvice=1 的 /home/today），
 *   避免白烧 AI 调用。潮汐表用 withAdvice=0，不耗 AI。
 */
import { DEFAULT_SPOT_ID } from '../config/env'
import { achieveApi, contentApi, homeApi, lightMapApi } from '../services/api'
import { todayDate } from './format'

let kicked = false

function later(fn: () => void, delay: number): void {
  setTimeout(fn, delay)
}

/**
 * 小程序启动（app.onLaunch）时调用：立刻开始并行预加载。
 * spotId 未知时用默认点位，不影响后续按真实点位再请求。
 */
export function preloadOnLaunch(spotId: string = DEFAULT_SPOT_ID): void {
  if (kicked) return
  kicked = true

  // 用本地日期（todayDate 走北京时间），避免 toISOString 的 UTC 差一天
  const today = todayDate()
  const month = today.slice(0, 7)

  // 按「用户最可能先点开」的顺序排：潮汐表/日历优先
  const tasks: Array<() => void> = [
    // ① 潮汐表当天曲线（withAdvice=0，不走 AI，快）
    () => { homeApi.today({ spotId, date: today, withAdvice: 0 }).catch(() => {}) },
    // ② 潮汐日历整月
    () => { homeApi.tideCalendar({ spotId, month }).catch(() => {}) },
    // ③ 赶海点列表（首页推荐 / 赶海点页 / 潮汐表地点选择共用）
    () => { contentApi.spots({ city: '青岛', page: 1, pageSize: 50 }).catch(() => {}) },
    // ④ 图鉴列表（首页已在预加载图片，这里补列表数据）
    () => { contentApi.encyclopedia({ page: 1, pageSize: 50 }).catch(() => {}) },
    // ⑤ 科普知识
    () => { contentApi.knowledge().catch(() => {}) },
    // ⑥ 点亮地图目录
    () => { lightMapApi.list().catch(() => {}) },
    // ⑦ 成就页：总览 + 勋章墙 + 排行榜
    () => { achieveApi.overview().catch(() => {}) },
    () => { achieveApi.medals().catch(() => {}) },
    () => { achieveApi.leaderboard().catch(() => {}) },
    // ⑧ 装备清单
    () => { contentApi.gear().catch(() => {}) }
  ]

  // 错峰：首页自身的请求优先，预加载从 200ms 起、每 100ms 发一个
  tasks.forEach((task, i) => later(task, 200 + i * 100))
}

/** 供「下拉刷新」等场景重置 */
export function resetPreload(): void {
  kicked = false
}
