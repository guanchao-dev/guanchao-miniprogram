import { watchApi } from '../../services/api'
import { fromApiRecord, listWatchGroups } from '../../utils/watchLog'

const EMPTY_DETAIL = {
  id: '',
  date: '',
  startedAt: '',
  endedAt: '',
  startTime: '',
  endTime: '',
  durationText: '',
  species: [],
  summary: '',
  mascot: 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-star.png'
}

Page({
  data: {
    loading: true,
    groups: [],
    showDetail: false,
    detail: EMPTY_DETAIL
  },

  onShow() {
    this.setData({ loading: true })
    // 先展示本地已有的记录（离线时写入的），再拉服务端记录合并
    this.setData({ groups: listWatchGroups() })
    watchApi.list()
      .then((list) => {
        const extra = (list || []).map(fromApiRecord).filter(Boolean)
        this.setData({ groups: listWatchGroups(extra as any) })
      })
      .catch(() => {})
      .finally(() => this.setData({ loading: false }))
  },

  onOpen(e: any) {
    const id = e.currentTarget.dataset.id
    const groups: any[] = this.data.groups || []
    let found = null
    groups.forEach((group) => {
      (group.items || []).forEach((item: any) => {
        if (item.id === id) found = item
      })
    })
    if (found) this.setData({ showDetail: true, detail: found })
    watchApi.detail(id)
      .then((data) => {
        const detail = fromApiRecord(data)
        if (detail) this.setData({ showDetail: true, detail })
      })
      .catch(() => {})
  },

  closeDetail() {
    this.setData({ showDetail: false })
  },

  noop() {}
})
