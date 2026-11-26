import { aiApi, watchApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { nowISO, nowTime, showError, toast } from '../../utils/format'
import { chooseImage, mediaUrl, uploadImage } from '../../utils/upload'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'
import { addWatchItem, getWatchSession, hasTrashToday } from '../../utils/watchLog'

/**
 * 生物识别 / 生态净滩（全局组件）
 * ------------------------------------------------------------
 * 流程和结果弹窗原本写在首页，但悬浮球在各页面都能点，
 * 所以抽成组件：拍照 → 上传 → AI 识别 → 结果确认 → 记入赶海记录，
 * 全部在当前页面就地完成，不跳首页。
 * 点位取当前赶海会话，不再依赖首页的页面数据。
 */

type GuessCandidate = {
  rank: number
  name: string
  latinName?: string
  probability: number
  probabilityText?: string
  confidenceLabel?: string
  reason?: string
  speciesId?: string | null
  inEncyclopedia?: boolean
  wikiPath?: string | null
}

/** 一个物品（图里一只生物）及其自己的候选列表 */
type GuessItem = {
  key: string
  index: number
  label: string
  count: number
  candidates: GuessCandidate[]
  /** 渲染用：默认只放首选，展开后是全部 */
  visibleCandidates: GuessCandidate[]
  expanded: boolean
  confirmedRank: number
  topName: string
}

/** 一件垃圾：只有一个结论，没有备选 */
type TrashItem = {
  key: string
  index: number
  label: string
  count: number
  name: string
  category: string
  categoryLabel: string
  probability: number
  probabilityText: string
  reason: string
  tip: string
  hazardNote: string
  confirmed: boolean
}

/** 后端新结构是 items[]；老记录（扁平 candidates）兜底成单物品 */
function normalizeGuessItems(raw: any): GuessItem[] {
  let list: any[] = Array.isArray(raw && raw.items) ? raw.items.slice() : []
  if (!list.length) {
    const legacy = Array.isArray(raw && raw.candidates) ? raw.candidates : []
    if (legacy.length) list = [{ label: '照片里的生物', candidates: legacy }]
  }
  return list
    .map((it: any, i: number) => {
      const candidates: GuessCandidate[] = (Array.isArray(it.candidates) ? it.candidates : []).slice(0, 3)
      return {
        key: `obj_${i + 1}`,
        index: i + 1,
        label: it.label || `发现 ${i + 1}`,
        count: Number(it.count) > 1 ? Number(it.count) : 1,
        candidates,
        visibleCandidates: candidates.slice(0, 1),
        expanded: false,
        confirmedRank: 0,
        topName: (candidates[0] && candidates[0].name) || ''
      }
    })
    .filter((it: GuessItem) => it.candidates.length > 0)
}

function normalizeTrashItems(raw: any): TrashItem[] {
  const list = Array.isArray(raw && raw.items) ? raw.items : []
  return list
    .map((it: any, i: number) => ({
      key: `trash_${i + 1}`,
      index: i + 1,
      label: it.label || `垃圾 ${i + 1}`,
      count: Number(it.count) > 1 ? Number(it.count) : 1,
      name: it.name || '',
      category: it.category || 'other',
      categoryLabel: it.categoryLabel || '其他垃圾',
      probability: Number(it.probability) || 0,
      probabilityText: it.probabilityText || '',
      reason: it.reason || '',
      tip: it.tip || '',
      hazardNote: it.hazardNote || '',
      confirmed: false
    }))
    .filter((it: TrashItem) => !!it.name)
}

Component({
  data: {
    showGuess: false,
    guessImage: '',
    guess: {} as any,
    guessItems: [] as GuessItem[],
    showTrash: false,
    trashImage: '',
    trash: {} as any,
    trashItems: [] as TrashItem[]
  },

  methods: {
    /** 对外入口：guess = 生物识别，trash = 生态净滩 */
    detect(mode: 'guess' | 'trash') {
      if (mode === 'trash') this.startTrash()
      else this.startGuess()
    },

    noop() {},

    /** 当前赶海点位：识别请求带上它，后端可据此过滤当地不可能出现的物种 */
    currentSpotId(): string {
      const session = getWatchSession()
      return (session && session.spot && session.spot.spotId) || ''
    },

    /** 徽章弹窗挂在页面层，这里用页面实例去 flush */
    flushPageUnlocks() {
      const pages = getCurrentPages()
      flushUnlocks(pages[pages.length - 1])
    },

    startGuess() {
      // 上传和 AI 识别都要求登录；先拦截，避免用户拍完照才 401
      if (!requireLogin()) return
      chooseImage()
        .then((filePath) => {
          this.setData({ guessImage: filePath })
          wx.showLoading({ title: '小螃蟹在看', mask: true })
          return uploadImage('speciesGuess', filePath)
        })
        .then((uploadId) => {
          // 带上定位：后端据此过滤掉当地不可能出现的物种（如海边不显示淡水鱼）
          const app = getApp()
          const g = (app && app.globalData) || {}
          return aiApi.speciesGuess({
            uploadId,
            spotId: this.currentSpotId(),
            // 与首页一致：赶海会话里没有实时潮位，用默认值占位，后端只当参考
            tideHeightM: 0.8,
            tideTrend: 'falling',
            clientTime: nowISO(),
            lat: g.userLat,
            lng: g.userLng
          })
        })
        .then((guess) => {
          ;(this as any).lastGuessId = guess && guess.guessId
          // 图里有几个生物就渲染几条，每条默认只展示首选，其余折叠；
          // 候选不自动写进赶海记录，等用户点「就是这个物种」再记那一种。
          wx.hideLoading()
          this.triggerEvent('show')
          this.setData({
            showGuess: true,
            guess: guess || {},
            guessItems: normalizeGuessItems(guess)
          })
          enqueueUnlocks((guess && guess.unlockedMedalIds) || [], 'guess')
          this.flushPageUnlocks()
        })
        .catch((err) => {
          // 先关 loading 再提示：两者共用同一个原生视图，顺序反了提示会被关掉
          wx.hideLoading()
          if (err && err.message === 'cancel') return
          if (err && err.code === 40101) {
            requireLogin()
            return
          }
          showError(err, '识别失败')
        })
    },

    /** 垃圾识别：拍照 → 上传 → 识物 + 判定类别（可回收 / 有害 / 厨余 / 其他） */
    startTrash() {
      if (!requireLogin()) return
      chooseImage()
        .then((filePath) => {
          this.setData({ trashImage: filePath })
          wx.showLoading({ title: '小螃蟹在看', mask: true })
          return uploadImage('speciesGuess', filePath)
        })
        .then((uploadId) => aiApi.trashGuess({ uploadId, spotId: this.currentSpotId(), clientTime: nowISO() }))
        .then((res) => {
          wx.hideLoading()
          // 判定为垃圾时可能解锁「深蓝小卫士」（medal_14）
          enqueueUnlocks((res && res.unlockedMedalIds) || [], 'trash')
          this.flushPageUnlocks()
          this.triggerEvent('show')
          this.setData({ showTrash: true, trash: res || {}, trashItems: normalizeTrashItems(res) })
        })
        .catch((err) => {
          wx.hideLoading()
          if (err && err.message === 'cancel') return
          if (err && err.code === 40101) {
            requireLogin()
            return
          }
          showError(err, '识别失败')
        })
    },

    closeGuess() {
      this.setData({ showGuess: false, guessItems: [] })
      this.triggerEvent('close')
    },

    closeTrash() {
      this.setData({ showTrash: false, trashItems: [] })
      this.triggerEvent('close')
    },

    /** 结果弹窗左上角的图鉴入口：不关弹窗，看完返回还能接着确认 */
    goWiki() {
      wx.navigateTo({ url: '/pages/wiki/wiki' })
    },

    /** 点某个候选：有图鉴条目就进物种详情 */
    openWiki(e: any) {
      const item = e.currentTarget.dataset.item || {}
      const id = item.speciesId
      if (!id) {
        toast('这个还没收录进图鉴')
        return
      }
      wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${id}` })
    },

    /** 展开 / 收起某一个物品的其他候选（每个物品独立） */
    toggleItemAll(e: any) {
      const oi = Number(e.currentTarget.dataset.oi)
      const item = (this.data.guessItems as GuessItem[])[oi]
      if (!item) return
      const expanded = !item.expanded
      this.setData({
        [`guessItems[${oi}].expanded`]: expanded,
        [`guessItems[${oi}].visibleCandidates`]: expanded ? item.candidates : item.candidates.slice(0, 1)
      })
    },

    /** 「就是这个物种」：把用户确认的这一种写进赶海记录（同一个只能确认一次） */
    onConfirmSpecies(e: any) {
      const oi = Number(e.currentTarget.dataset.oi)
      const cand = e.currentTarget.dataset.item || {}
      const item = (this.data.guessItems as GuessItem[])[oi]
      if (!item || !cand.name || !cand.rank) return
      if (item.confirmedRank) {
        if (item.confirmedRank !== cand.rank) toast('这一条已经记过了，看看别的发现')
        return
      }
      const session = getWatchSession()
      if (!session) {
        toast('先到潮汐表页开始赶海，识别结果才会记录')
        return
      }
      const entry = {
        name: cand.name,
        time: nowTime(),
        kind: 'species' as const,
        speciesId: cand.speciesId || '',
        guessId: (this as any).lastGuessId,
        label: item.label,
        count: item.count
      }
      addWatchItem(entry)
      if (session.id) {
        watchApi.addSpecies(session.id, entry)
          .then((res: any) => {
            enqueueUnlocks((res && res.unlockedMedalIds) || [], 'watch')
            const lit = res && res.newlyLitSpecies
            if (lit) {
              enqueueUnlocks([{
                medalId: lit.id,
                id: lit.id,
                title: lit.name,
                description: '已收录进你的图鉴',
                icon: mediaUrl(lit.coverUrl || ''),
                source: 'species'
              }], 'species')
            }
            this.flushPageUnlocks()
          })
          .catch(() => {})
      }
      this.setData({ [`guessItems[${oi}].confirmedRank`]: cand.rank })
      toast('已记入赶海记录：' + cand.name)
    },

    /** 「就是它」：把这件垃圾记进赶海记录（每天只允许记一次） */
    onConfirmTrash(e: any) {
      const oi = Number(e.currentTarget.dataset.oi)
      const item = (this.data.trashItems as TrashItem[])[oi]
      if (!item || item.confirmed) return
      const session = getWatchSession()
      if (!session) {
        toast('先到潮汐表页开始赶海，识别结果才会记录')
        return
      }
      // 本地先拦一道，点完立刻有反馈；服务端还会再拦一次
      if (hasTrashToday()) {
        toast('今天已经记过一次垃圾了，明天再来捡吧')
        return
      }
      const entry = {
        name: item.name,
        time: nowTime(),
        kind: 'trash' as const,
        category: item.category,
        categoryLabel: item.categoryLabel,
        label: item.label,
        count: item.count,
        amount: (this.data.trash as any)?.amount || ''
      }
      const done = () => {
        this.setData({ [`trashItems[${oi}].confirmed`]: true })
        toast('已记入赶海记录：' + item.name)
      }
      if (session.id) {
        watchApi.addSpecies(session.id, entry)
          .then((res: any) => {
            if (res && res.trashDailyLimit) {
              toast('今天已经记过一次垃圾了，明天再来捡吧')
              return
            }
            enqueueUnlocks((res && res.unlockedMedalIds) || [], 'watch')
            this.flushPageUnlocks()
            addWatchItem(entry)
            done()
          })
          .catch(() => {
            // 网络失败也记本地，保证这次赶海的收获不丢
            addWatchItem(entry)
            done()
          })
        return
      }
      addWatchItem(entry)
      done()
    }
  }
})
