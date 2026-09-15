import { toast } from '../../utils/format'

/**
 * 外链承载页。
 *
 * 小程序不能直接 navigateTo 外部网址，必须走 web-view；而 web-view 的域名又受限制
 * （要么在「业务域名」白名单里，要么小程序已关联该公众号）。这里只放行 mp.weixin.qq.com，
 * 免得这个页面变成一个可以打开任意网址的开放跳板。
 */
const ALLOWED_HOSTS = ['mp.weixin.qq.com']

/**
 * web-view 加载超时。
 * 被域名白名单拦住时，真机有时只白屏、既不发 binderror 也不发 bindload，
 * 用户会卡在一个空白页上只能按返回。所以再加一道超时兜底。
 * 4 秒是折中：太短会误伤慢网下的正常加载，太长则白屏体验很差。
 */
const LOAD_TIMEOUT_MS = 4000

Page({
  data: {
    url: '',
    failed: false
  },

  _timer: null as any,
  _loaded: false,

  onLoad(query: Record<string, string>) {
    const raw = query && query.url ? decodeURIComponent(query.url) : ''
    const title = query && query.title ? decodeURIComponent(query.title) : ''
    if (title) wx.setNavigationBarTitle({ title })

    if (!raw) {
      this.setData({ failed: true })
      return
    }
    const allowed = ALLOWED_HOSTS.some((h) => raw.indexOf(`https://${h}/`) === 0)
    if (!allowed) {
      this.setData({ failed: true })
      toast('这个链接暂时打不开')
      return
    }
    this.setData({ url: raw })
    this._arm()
  },

  onUnload() {
    this._clear()
  },

  _arm() {
    this._clear()
    this._loaded = false
    this._timer = setTimeout(() => {
      if (!this._loaded) this.setData({ failed: true })
    }, LOAD_TIMEOUT_MS)
  },

  _clear() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  },

  /** web-view 页面加载完成 */
  onWebLoad() {
    this._loaded = true
    this._clear()
  },

  /** web-view 明确报错（域名没放行等） */
  onWebError() {
    this._clear()
    this.setData({ failed: true })
  },

  retry() {
    const url = this.data.url
    if (!url) return
    // 先卸载再挂载，强制 web-view 重新发起请求
    this.setData({ url: '', failed: false })
    wx.nextTick(() => {
      this.setData({ url })
      this._arm()
    })
  },

  copyLink() {
    if (!this.data.url) return
    wx.setClipboardData({
      data: this.data.url,
      success: () => toast('链接已复制，可粘贴到浏览器打开')
    })
  }
})
