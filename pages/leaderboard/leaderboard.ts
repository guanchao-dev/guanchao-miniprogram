import { achieveApi } from '../../services/api'
import { showError } from '../../utils/format'
import { downloadImage, mediaUrl } from '../../utils/upload'

const DEFAULT_AVATAR = 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png'
const PAGE_SIZE = 20

Page({
  data: {
    loading: true,
    loadingMore: false,
    list: [],
    page: 1,
    total: 0,
    hasMore: false,
    emptyText: '暂无排行数据'
  },

  onLoad() {
    this.load(true)
  },

  load(reset: boolean) {
    const page = reset ? 1 : this.data.page + 1
    this.setData(reset ? { loading: true, list: [] } : { loadingMore: true })

    achieveApi.leaderboard({ page, pageSize: PAGE_SIZE })
      .then((data: any) => {
        const rows = (data && data.list) || []
        const total = (data && data.total) || 0
        const mapped = rows.map((item: any, i: number) => ({
          key: `${item.userId || i}_${page}_${i}`,
          rank: item.rank || ((page - 1) * PAGE_SIZE + i + 1),
          name: item.nickname || '寻潮探索者',
          level: `Lv.${item.level || 1}`,
          score: item.score || 0,
          me: !!item.me,
          avatar: DEFAULT_AVATAR,
          avatarUrl: item.avatarUrl || ''
        }))
        const list = reset ? mapped : this.data.list.concat(mapped)
        this.setData({
          list,
          page,
          total,
          hasMore: list.length < total,
          emptyText: '暂无排行数据'
        })
        // 用户头像走网络：下载成临时文件再渲染
        mapped.forEach((item: any, i: number) => {
          const url = mediaUrl(item.avatarUrl)
          if (!url || item.avatarUrl.indexOf('/users/') !== 0) return
          downloadImage(url).then((src) => {
            if (!src) return
            const idx = reset ? i : this.data.list.length - mapped.length + i
            this.setData({ [`list[${idx}].avatar`]: src })
          })
        })
      })
      .catch((err) => {
        if (reset) this.setData({ list: [], total: 0, hasMore: false })
        showError(err, '排行榜加载失败')
      })
      .finally(() => this.setData({ loading: false, loadingMore: false }))
  },

  onReachBottom() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return
    this.load(false)
  },

  onPullDownRefresh() {
    this.load(true)
    setTimeout(() => wx.stopPullDownRefresh(), 400)
  }
})
