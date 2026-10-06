import { contentApi, spotVisitApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'
import { CITY, mergeGuideSpots } from '../../utils/spotGuide'

/**
 * 我的赶海点：全部点位铺成一面「点亮墙」（纯文本，不用图标）——
 * 去过的按成就页「已点亮」的金边暖底样式，没去过的置灰。
 *
 * 点位底表来自 /spots（一定取得到），点亮标记来自 /spots/visited 按 id 覆盖。
 * 点亮接口取不到（未登录 / 后端未实现）时，全部按灰态展示，页面不会空。
 */
Page({
  data: {
    loading: true,
    loggedIn: false,
    total: 0,
    visitedCount: 0,
    percent: 0,
    list: []
  },

  onLoad() {
    const loggedIn = isLoggedIn()
    this.setData({ loggedIn })
    if (loggedIn) this.load()
    else this.setData({ loading: false })
  },

  onShow() {
    // 点击「去登录」跳登录页返回后，自动补加载
    if (!this.data.loggedIn && isLoggedIn()) {
      this.setData({ loggedIn: true })
      this.load()
    }
  },

  load() {
    this.setData({ loading: true })
    Promise.all([
      contentApi
        .spots({ city: CITY, page: 1, pageSize: 50 })
        .then((res) => mergeGuideSpots(res.list || [], null))
        .catch(() => [] as any[]),
      spotVisitApi.visited().catch(() => null as any)
    ])
      .then(([spots, visitData]: any[]) => {
        const rows: any[] = ((visitData && (visitData.list || visitData.items)) || []).filter(
          (item: any) => item && item.id
        )
        const litIds: Record<string, boolean> = {}
        rows.forEach((item: any) => {
          if (item.visited) litIds[String(item.id)] = true
        })

        const list: any[] = []
        const seen: Record<string, boolean> = {}
        const add = (id: any, name: any, visited: boolean) => {
          const key = String(id || '')
          if (!key || seen[key]) return
          seen[key] = true
          list.push({ id: key, name: name || '赶海点', visited })
        }
        // 底表用 /spots 的全部点位，再用点亮接口的标记覆盖
        ;(spots || []).forEach((spot: any) => add(spot.id, spot.name, !!litIds[String(spot.id)]))
        // 点亮接口里有、但 /spots 没返回的点位（如用户投稿）也补齐
        rows.forEach((item: any) => add(item.id, item.name, !!item.visited))

        // 去过的排前面，和成就墙「已点亮优先」的观感一致（不用 sort 的稳定性）
        const ordered = list.filter((row) => row.visited).concat(list.filter((row) => !row.visited))
        const total = ordered.length
        const visitedCount = ordered.filter((row) => row.visited).length
        this.setData({
          list: ordered,
          total,
          visitedCount,
          percent: total ? Math.min(100, Math.round((visitedCount / total) * 100)) : 0
        })
      })
      .catch((err) => {
        this.setData({ list: [], total: 0, visitedCount: 0, percent: 0 })
        showError(err, '赶海点加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  goLogin() {
    requireLogin()
  }
})