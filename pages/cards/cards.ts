import { contentApi, watchApi } from '../../services/api'
import { mediaUrl } from '../../utils/upload'
import {
  creatureCount,
  creatureItems,
  fromApiRecord,
  groupFindings,
  listWatchGroups,
  trashAmount,
  TRASH_AMOUNT_TEXT
} from '../../utils/watchLog'

const EMPTY_DETAIL = {
  id: '',
  date: '',
  startedAt: '',
  endedAt: '',
  startTime: '',
  endTime: '',
  durationText: '',
  species: [],
  groups: [],
  summary: '',
  creatureCount: 0,
  trashAmountText: '无',
  creatureCovers: [] as string[],
  mascot: 'https://www.blueakaiwu.cn/api/v1/static/assets/badges/crab-star.png'
}

/** speciesId -> 图鉴封面地址。观潮记录里只存 speciesId，图鉴图要另外查。 */
let coverMap: Record<string, string> = {}

/**
 * 拉一次图鉴名录，建「物种 id -> 封面」映射。
 *
 * 为什么在前端做而不是让后端把 coverUrl 塞进记录里：本地（离线记的）记录
 * 也走同一套渲染，前端统一查一次，本地记录和服务端记录才不会一个有一个没有。
 */
function loadCovers(): Promise<void> {
  return contentApi
    .encyclopedia({ page: 1, pageSize: 100 })
    .then((res: any) => {
      const map: Record<string, string> = {}
      ;(res && res.list ? res.list : []).forEach((it: any) => {
        if (it && it.id && it.coverUrl) map[String(it.id)] = mediaUrl(it.coverUrl)
      })
      coverMap = map
    })
    .catch(() => {
      // 拿不到就只是不显示图鉴图，不影响记录本身
    })
}

/** 详情按「生物 / 垃圾」分组展示，组内在 groupFindings 里排好序 */
function withGroups(record: any) {
  return { ...record, groups: groupFindings(record && record.species) }
}

/** 给一条记录补上「观潮记录卡」需要的派生字段：生物种数 / 垃圾量 / 图鉴图 */
function decorate(record: any) {
  const species = (record && record.species) || []
  const seen: Record<string, boolean> = {}
  const covers: string[] = []
  creatureItems(species).forEach((s) => {
    const sid = String(s.speciesId || '')
    const url = sid ? coverMap[sid] : ''
    if (url && !seen[url]) {
      seen[url] = true
      covers.push(url)
    }
  })
  return {
    ...record,
    creatureCount: creatureCount(species),
    trashAmountText: TRASH_AMOUNT_TEXT[trashAmount(species)] || '无',
    creatureCovers: covers
  }
}

function decorateGroups(groups: any[]) {
  return (groups || []).map((g) => ({
    ...g,
    items: (g.items || []).map(decorate)
  }))
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
    // 先渲染本地记录（离线时记的也在里面），拿到图鉴封面与服务端记录后再重画一次
    this.setData({ groups: decorateGroups(listWatchGroups()) })
    Promise.all([
      loadCovers(),
      watchApi
        .list()
        .then((list) => (list || []).map(fromApiRecord).filter(Boolean))
        .catch(() => [])
    ])
      .then(([, extra]) => {
        this.setData({ groups: decorateGroups(listWatchGroups(extra as any)) })
      })
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
    if (found) this.setData({ showDetail: true, detail: withGroups(found) })
    watchApi
      .detail(id)
      .then((data) => {
        const detail = fromApiRecord(data)
        if (detail) this.setData({ showDetail: true, detail: withGroups(decorate(detail)) })
      })
      .catch(() => {})
  },

  closeDetail() {
    this.setData({ showDetail: false })
  },

  noop() {}
})
