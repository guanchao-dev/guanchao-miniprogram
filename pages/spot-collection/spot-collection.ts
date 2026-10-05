import { spotVisitApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError } from '../../utils/format'

const DEFAULT_ICON = 'https://www.blueakaiwu.cn/api/v1/static/assets/home/home-nearby.png'

/**
 * 我的赶海点：展示用户在赶海点排名里的 42 个点位的点亮进度。
 * 顶部进度条 + 下方点位图标（一排 4 个，去过点亮、没去过置灰）。
 * 数据为账号维度，需登录。
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
    spotVisitApi.visited()
      .then((data) => {
        const raw = data || {}
        const list = (raw.list || raw.items || []).map((item: any) => ({
          id: item.id,
          name: item.name || '赶海点',
          icon: item.icon || item.iconUrl || DEFAULT_ICON,
          visited: !!item.visited
        }))
        const total = Number(raw.total) || list.length
        const visited = Number(raw.visitedCount)
        const visitedCount = Number.isNaN(visited)
          ? list.filter((row: any) => row.visited).length
          : visited
        this.setData({
          list,
          total,
          visitedCount,
          percent: total ? Math.min(100, Math.round((visitedCount / total) * 100)) : 0
        })
      })
      .catch((err) => {
        this.setData({ list: [] })
        showError(err, '赶海点加载失败')
      })
      .finally(() => this.setData({ loading: false }))
  },

  goLogin() {
    requireLogin()
  }
})