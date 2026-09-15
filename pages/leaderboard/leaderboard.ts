import { achieveApi, userApi } from '../../services/api'
import { isLoggedIn, requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { downloadImage, mediaUrl } from '../../utils/upload'

const DEFAULT_AVATAR = 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-cloud.png'
const PAGE_SIZE = 20

Page({
  data: {
    scope: 'all',            // all=全站榜 | friends=好友榜
    tabs: [
      { id: 'all', name: '全部用户' },
      { id: 'friends', name: '我的好友' }
    ],
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

  onTab(e: any) {
    const scope = e.currentTarget.dataset.id
    if (!scope || scope === this.data.scope) return
    this.setData({ scope })
    this.load(true)
  },

  load(reset: boolean) {
    const scope = this.data.scope
    if (scope === 'friends' && !isLoggedIn()) {
      this.setData({ loading: false, list: [], total: 0, hasMore: false, emptyText: '登录后可以看好友榜' })
      return
    }
    const page = reset ? 1 : this.data.page + 1
    this.setData(reset ? { loading: true, list: [] } : { loadingMore: true })

    achieveApi.leaderboard({ scope, page, pageSize: PAGE_SIZE })
      .then((data: any) => {
        const rows = (data && data.list) || []
        const total = (data && data.total) || 0
        const mapped = rows.map((item: any, i: number) => ({
          key: `${item.userId || i}_${page}_${i}`,
          userId: item.userId,
          rank: item.rank || ((page - 1) * PAGE_SIZE + i + 1),
          name: item.nickname || '寻潮探索者',
          level: `Lv.${item.level || 1}`,
          score: item.score || 0,
          me: !!item.me,
          followed: !!item.followed,
          avatar: DEFAULT_AVATAR,
          avatarUrl: item.avatarUrl || ''
        }))
        const list = reset ? mapped : this.data.list.concat(mapped)
        this.setData({
          list,
          page,
          total,
          hasMore: list.length < total,
          emptyText: scope === 'friends' ? '还没有关注的人，去「全部用户」里点关注吧' : '暂无排行数据'
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
  },

  /** 关注 / 取关 */
  onFollow(e: any) {
    if (!requireLogin()) return
    const userId = e.currentTarget.dataset.id
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.list[index]
    if (!userId || !item || item.me) return
    const req = item.followed ? userApi.unfollow(userId) : userApi.follow(userId)
    req.then((res: any) => {
      this.setData({ [`list[${index}].followed`]: !!(res && res.followed) })
      toast(res && res.followed ? '已关注' : '已取消关注')
    }).catch((err) => showError(err, '操作失败'))
  },

  noop() {}
})
