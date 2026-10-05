import { contentApi, homeApi } from '../../services/api'
import { showError, toast, trendText } from '../../utils/format'
import { navigateSpot } from '../../utils/amapNav'
import { requireLogin } from '../../utils/auth'
import { getCachedLocation, haversineM, formatDistance } from '../../utils/spotGuide'

function tideLabel(type?: string): string {
  const map: Record<string, string> = {
    high: '高潮',
    low: '低潮',
    rising: '涨潮',
    falling: '退潮'
  }
  return map[type || ''] || ''
}

Page({
  data: {
    spot: {} as any,
    photos: [] as string[],
    tideRows: [] as Array<{ time: string; height: string; label: string }>,
    tideSummary: '正在读取今日潮汐…',
    // 反馈弹层
    fbVisible: false,
    fbContent: '',
    fbContact: '',
    fbSubmitting: false
  },

  onLoad(query: any) {
    const id = query && query.id
    if (!id) return
    this.loadDetail(id)
  },

  loadDetail(id: string) {
    contentApi.spot(id)
      .then((spot: any) => {
        if (!spot) return
        const photos = (spot.photos || spot.panoramaUrls || []).filter(Boolean)
        if (spot.coverUrl && photos.indexOf(spot.coverUrl) < 0) photos.unshift(spot.coverUrl)
        // 计算距离：后端有 distanceM 直接用，否则用缓存位置 + haversine 公式
        let distanceM = spot.distanceM != null ? Number(spot.distanceM) : null
        if ((distanceM == null || Number.isNaN(distanceM)) && spot.latitude && spot.longitude) {
          const loc = getCachedLocation()
          if (loc) {
            distanceM = haversineM(loc.lat, loc.lng, Number(spot.latitude), Number(spot.longitude))
          }
        }
        this.setData({
          spot: Object.assign(
            { safetyTags: [], gearList: [], species: [] },
            spot,
            {
              gearList: (spot.gearList || []).map((item: any) =>
                typeof item === 'string' ? item : (item && (item.name || item.title)) || ''
              ).filter(Boolean),
              distanceText: formatDistance(distanceM),
              // 去掉来源里的排名说明（如「（极热门·区内第1名）」）
              source: (spot.source || '').replace(/[（(][^）)]*[）)]/g, '').trim()
            }
          ),
          photos
        })
      })
      .catch((err) => showError(err, '点位详情加载失败'))

    // 加载今日潮汐
    homeApi.today({ spotId: id })
      .then((data: any) => {
        const tide = (data && data.tide) || {}
        const points = tide.points || tide.hourly || []
        const rows = points.map((item: any) => ({
          time: item.time || item.at || '--',
          height: item.heightM != null ? `${item.heightM}m` : '',
          label: tideLabel(item.type)
        }))
        const height = tide.currentHeightM != null ? tide.currentHeightM : ''
        const summary = height !== ''
          ? `现在约 ${height}m · ${trendText(tide.trend)}`
          : '潮汐仅供参考，请以现场公示为准'
        this.setData({ tideRows: rows, tideSummary: summary })
      })
      .catch(() => {
        this.setData({ tideSummary: '潮汐暂不可用，请以现场公示为准' })
      })
  },

  /** 预览封面图 */
  previewPhoto(e: any) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ urls: this.data.photos, current: url })
  },

  /** 打开物种详情 */
  openSpecies(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${id}` })
  },

  onNavigate() {
    const spot: any = this.data.spot
    navigateSpot({
      name: spot.name,
      navName: spot.navName || spot.parkingName,
      latitude: Number(spot.latitude || spot.lat),
      longitude: Number(spot.longitude || spot.lng)
    })
  },

  /* ===== 反馈：把问题直接发给管理员，带上当前点位 id ===== */
  openFeedback() {
    // 反馈要落库到具体用户，未登录先引导登录
    if (!requireLogin()) return
    this.setData({ fbVisible: true, fbContent: '', fbContact: '' })
  },

  closeFeedback() {
    this.setData({ fbVisible: false })
  },

  onFbInput(e: any) {
    this.setData({ fbContent: e.detail.value })
  },

  onFbContact(e: any) {
    this.setData({ fbContact: e.detail.value })
  },

  submitFeedback() {
    if (this.data.fbSubmitting) return
    const content = (this.data.fbContent || '').trim()
    if (!content) {
      toast('请先写一下问题')
      return
    }
    this.setData({ fbSubmitting: true })
    contentApi
      .feedback({
        content,
        contact: (this.data.fbContact || '').trim(),
        spotId: this.data.spot.id
      })
      .then(() => {
        this.setData({ fbVisible: false, fbContent: '', fbContact: '', fbSubmitting: false })
        toast('已反馈，谢谢！')
      })
      .catch((err) => {
        this.setData({ fbSubmitting: false })
        showError(err, '提交失败')
      })
  }
})
