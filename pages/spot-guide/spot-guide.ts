import { contentApi, homeApi } from '../../services/api'
import { trendText } from '../../utils/format'
import { GuideSpot, loadGuideSpots } from '../../utils/spotGuide'

function tideLabel(type?: string): string {
  const map: Record<string, string> = {
    high: '高潮',
    low: '低潮',
    rising: '涨潮',
    falling: '退潮'
  }
  return map[type || ''] || '潮位'
}

Page({
  data: {
    loading: true,
    list: [] as GuideSpot[],
    showDetail: false,
    detail: {} as GuideSpot,
    detailLoading: false,
    photos: [] as string[],
    tideRows: [] as Array<{ time: string; height: string; label: string }>,
    tideSummary: '正在读取今日潮汐…'
  },

  onShow() {
    this.setData({ loading: true })
    loadGuideSpots()
      .then((list) => this.setData({ list: list || [] }))
      .catch(() => this.setData({ list: [] }))
      .finally(() => this.setData({ loading: false }))
  },

  onOpen(e: any) {
    const id = e.currentTarget.dataset.id
    const detail = (this.data.list || []).find((item: GuideSpot) => item.id === id)
    if (!detail) return
    const photos = (detail.photos && detail.photos.length)
      ? detail.photos
      : (detail.coverUrl ? [detail.coverUrl] : [])
    this.setData({
      showDetail: true,
      detail,
      photos,
      tideRows: [],
      tideSummary: '正在读取今日潮汐…'
    })
    this.loadDetail(detail)
  },

  loadDetail(spot: GuideSpot) {
    contentApi.spot(spot.id)
      .then((data) => {
        if (!data) return
        const photos = (data.photos || data.panoramaUrls || []).filter(Boolean)
        if (data.coverUrl && photos.indexOf(data.coverUrl) < 0) photos.unshift(data.coverUrl)
        this.setData({
          detail: Object.assign({}, this.data.detail, {
            observeHint: data.observeHint || data.description || spot.observeHint,
            openTime: data.openTime || spot.openTime,
            safetyTags: (data.safetyTags && data.safetyTags.length) ? data.safetyTags : spot.safetyTags
          }),
          photos: photos.length ? photos : this.data.photos
        })
      })
      .catch(() => {})

    homeApi.today({ spotId: spot.id })
      .then((data) => {
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
        this.setData({
          tideRows: rows,
          tideSummary: summary
        })
      })
      .catch(() => {
        this.setData({ tideSummary: '潮汐暂不可用，请以现场公示为准' })
      })
  },

  closeDetail() {
    this.setData({ showDetail: false })
  },

  noop() {},

  openSpecies(e: any) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/wiki-detail/wiki-detail?id=${id}` })
  },

  previewPhoto(e: any) {
    const url = e.currentTarget.dataset.url
    const photos = this.data.photos || []
    if (!url && !photos.length) return
    wx.previewImage({
      current: url || photos[0],
      urls: photos.length ? photos : [url]
    })
  },

  goExplore() {
    const id = (this.data.detail && this.data.detail.id) || 'spot_qd_shilaoren'
    wx.navigateTo({ url: `/pages/explore/explore?venueId=${id}` })
  }
})
