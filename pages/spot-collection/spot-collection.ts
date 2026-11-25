import { spotVisitApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'
import { loadAllGuideSpots } from '../../utils/spotGuide'

/** 城市的展示顺序：青岛在前，其余按地区/热度习惯排 */
const CITY_ORDER = ['青岛', '海口', '三亚', '陵水', '文昌', '万宁', '琼海', '澄迈', '儋州', '昌江', '东方', '厦门', '威海']

function cityRank(city: string): number {
  const index = CITY_ORDER.indexOf(city)
  return index < 0 ? 99 : index
}

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
    groups: [],
    list: [],
    // 筛选：城市 → 区，和搜索结果同一套两级分类
    cities: [],
    city: '',
    districts: [],
    district: '',
    visibleSpots: []
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
      // 全国所有收录城市（青岛、海南各市、厦门等），不只当前地区
      loadAllGuideSpots().catch(() => [] as any[]),
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
        const add = (id: any, name: any, visited: boolean, city: any, district: any) => {
          const key = String(id || '')
          if (!key || seen[key]) return
          seen[key] = true
          list.push({ id: key, name: name || '赶海点', visited, city: city || '', district: district || '' })
        }
        // 底表用 /spots 的全部点位，再用点亮接口的标记覆盖
        ;(spots || []).forEach((spot: any) => add(spot.id, spot.name, !!litIds[String(spot.id)], spot.city, spot.district))
        // 点亮接口里有、但 /spots 没返回的点位（如用户投稿）也补齐
        rows.forEach((item: any) => add(item.id, item.name, !!item.visited, item.city, item.district))

        // 按「城市 + 区」分组，标题如「青岛崂山区」「三亚天涯区」
        const groups: Array<{ key: string; city: string; district: string; title: string; list: any[] }> = []
        const groupMap: Record<string, any> = {}
        list.forEach((row) => {
          const city = row.city || '其他'
          const district = row.district || ''
          const key = `${city}|${district}`
          if (!groupMap[key]) {
            groupMap[key] = { key, city, district, title: district ? `${city}${district}` : city, list: [] }
            groups.push(groupMap[key])
          }
          groupMap[key].list.push(row)
        })

        // 组内去过的排前面，和成就墙「已点亮优先」的观感一致
        groups.forEach((group) => {
          group.list = group.list.filter((row) => row.visited).concat(group.list.filter((row) => !row.visited))
        })
        // 城市按配置顺序；同一城市内按区名排
        groups.sort((a, b) => {
          const byCity = cityRank(a.city) - cityRank(b.city)
          if (byCity !== 0) return byCity
          return String(a.district).localeCompare(String(b.district), 'zh')
        })

        const total = list.length
        const visitedCount = list.filter((row) => row.visited).length
        const cities: string[] = []
        groups.forEach((group) => {
          if (cities.indexOf(group.city) < 0) cities.push(group.city)
        })
        this.setData({
          list,
          groups,
          cities,
          total,
          visitedCount,
          percent: total ? Math.min(100, Math.round((visitedCount / total) * 100)) : 0
        }, () => this.applyFilter(cities[0] || '', ''))
      })
      .catch((err) => {
        this.setData({
          list: [],
          groups: [],
          cities: [],
          city: '',
          districts: [],
          district: '',
          visibleSpots: [],
          total: 0,
          visitedCount: 0,
          percent: 0
        })
        showError(err, '赶海点加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  onCity(e: any) {
    const city = e.currentTarget.dataset.city || ''
    if (!city || city === this.data.city) return
    this.applyFilter(city, '')
  },

  onDistrict(e: any) {
    const district = e.currentTarget.dataset.id || ''
    if (district === this.data.district) return
    this.applyFilter(this.data.city, district)
  },

  /** 按城市 + 区筛出要显示的点位牌 */
  applyFilter(city: string, district: string) {
    const groups: any[] = this.data.groups
    const cityGroups = groups.filter((group) => group.city === city)
    const districts: Array<{ id: string; name: string }> = [{ id: '', name: '全部' }]
    const seen: Record<string, boolean> = {}
    cityGroups.forEach((group) => {
      if (group.district && !seen[group.district]) {
        seen[group.district] = true
        districts.push({ id: group.district, name: group.district })
      }
    })
    const nextDistrict = districts.some((item) => item.id === district) ? district : ''
    const visibleSpots: any[] = []
    cityGroups.forEach((group) => {
      if (nextDistrict && group.district !== nextDistrict) return
      group.list.forEach((row: any) => visibleSpots.push(row))
    })
    this.setData({ city, district: nextDistrict, districts, visibleSpots })
  },

  goLogin() {
    requireLogin()
  },

  /** 点任意点位（含未点亮）进入点位介绍 */
  openSpot(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${id}` })
  }
})