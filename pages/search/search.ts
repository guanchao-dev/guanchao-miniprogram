import { contentApi, homeApi } from '../../services/api'
import { showError, toast } from '../../utils/format'

/** 搜索只认名称：点位名 / 图鉴名里不含关键词的不要（接口会按简介、常见生物等宽泛匹配） */
function nameMatches(name: string, keyword: string): boolean {
  const kw = String(keyword || '').toLowerCase()
  if (!kw) return false
  return String(name || '').toLowerCase().indexOf(kw) >= 0
}

Page({
  data: {
    keyword: '',
    searched: false,
    // 结果分类：赶海点 / 图鉴，一次只显示一类
    tab: 'spot',
    // 赶海点下面的二级地点（如 青岛），默认选中第一个
    cities: [],
    city: '',
    spots: [],
    spotGroups: [],
    visibleGroups: [],
    species: []
  },

  onLoad(query: Record<string, string>) {
    const keyword = decodeURIComponent((query && query.keyword) || '').trim()
    if (!keyword) return
    this.setData({ keyword }, () => this.onSearch())
  },

  onInput(e: any) {
    this.setData({ keyword: e.detail.value || '' })
  },

  onTab(e: any) {
    const tab = e.currentTarget.dataset.tab === 'wiki' ? 'wiki' : 'spot'
    if (tab === this.data.tab) return
    this.setData({ tab })
  },

  onCity(e: any) {
    const city = e.currentTarget.dataset.city || ''
    if (!city || city === this.data.city) return
    this.setData({
      city,
      visibleGroups: this.data.spotGroups.filter((group: any) => group.city === city)
    })
  },

  onSearch() {
    const keyword = (this.data.keyword || '').trim()
    if (!keyword) {
      toast('请输入关键词')
      return
    }
    this.setData({ keyword })
    const apply = (spots: any[], species: any[]) => {
      // 接口返回的是宽泛匹配（简介、常见生物里出现关键词也会算），这里再按名称过滤一次
      const spotRows = (spots || []).filter((item: any) => nameMatches(item.name, keyword))
      const wikiRows = (species || []).filter((item: any) => nameMatches(item.name, keyword))
      const spotGroups = this.groupSpots(spotRows)
      const cities = spotGroups.map((group) => group.city)
      // 重新搜索时保留还在结果里的城市，否则回到第一个
      const city = cities.indexOf(this.data.city) >= 0 ? this.data.city : (cities[0] || '')
      this.setData({
        searched: true,
        spots: spotRows,
        spotGroups,
        species: wikiRows,
        cities,
        city,
        visibleGroups: spotGroups.filter((group) => group.city === city)
      })
    }
    homeApi.search(keyword)
      .then((data) => {
        apply((data && data.spots && data.spots.list) || [], (data && data.species && data.species.list) || [])
      })
      .catch(() => {
        Promise.all([
          contentApi.spots({ keyword, page: 1, pageSize: 50 }),
          contentApi.encyclopedia({ keyword, page: 1, pageSize: 20 })
        ]).then(([spots, wiki]) => {
          apply(spots.list || [], wiki.list || [])
        }).catch((err) => showError(err, '搜索失败'))
      })
  },

  /** 点位按城市分组，避免不同城市的结果交叉混排 */
  groupSpots(spots: any[]) {
    const groups: Array<{ city: string; list: any[] }> = []
    const map: Record<string, any> = {}
    ;(spots || []).forEach((item: any) => {
      const city = item.city || '其他'
      if (!map[city]) {
        map[city] = { city, list: [] }
        groups.push(map[city])
      }
      map[city].list.push(Object.assign({}, item, { shortName: this.shortSpotName(item.name, city) }))
    })
    return groups
  },

  /** 点位名形如「青岛·连三岛」，已有城市分类后只显示点位名 */
  shortSpotName(name: string, city: string): string {
    const raw = String(name || '')
    const prefix = `${city}·`
    return raw.indexOf(prefix) === 0 ? raw.slice(prefix.length) : raw
  },

  openSpot(e: any) {
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${e.currentTarget.dataset.id}` })
  },

  openWiki(e: any) {
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${e.currentTarget.dataset.id}` })
  }
})
