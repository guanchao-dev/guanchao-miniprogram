import { contentApi, homeApi } from '../../services/api'
import { showError, trendText } from '../../utils/format'
import { requireLogin } from '../../utils/auth'
import { chooseImages, uploadImage } from '../../utils/upload'
import { GuideSpot, loadGuideSpots } from '../../utils/spotGuide'
import { navigateSpot } from '../../utils/amapNav'

/** 用户上传现场照片的张数上限 */
const MAX_UPLOAD_PHOTOS = 3

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
    /** 筛选后的列表 */
    filteredList: [] as GuideSpot[],
    /** 所有区域列表，包含「全部」 */
    districts: [] as string[],
    /** 当前选中区域，空串表示全部 */
    currentDistrict: '',
    showDetail: false,
    detail: {} as GuideSpot,
    detailLoading: false,
    photos: [] as string[],
    /** 现场照片上传中（禁用按钮，避免重复提交） */
    uploadingPhotos: false,
    tideRows: [] as Array<{ time: string; height: string; label: string }>,
    tideSummary: '正在读取今日潮汐…'
  },

  onShow() {
    this.setData({ loading: true })
    loadGuideSpots()
      .then((list) => {
        const districts = this.extractDistricts(list)
        this.setData({ list: list || [], districts })
        this.applyFilter()
      })
      .catch(() => this.setData({ list: [] }))
      .finally(() => this.setData({ loading: false }))
  },

  /** 从点位列表中提取所有区域，去重后前面加「全部」 */
  extractDistricts(list: GuideSpot[]): string[] {
    const set = new Set<string>()
    ;(list || []).forEach((s) => {
      if (s.district) set.add(s.district)
    })
    return ['全部'].concat(Array.from(set))
  },

  /** 切换区域筛选 */
  onSelectDistrict(e: any) {
    const district = e.currentTarget.dataset.district || ''
    this.setData({ currentDistrict: district === '全部' ? '' : district })
    this.applyFilter()
  },

  /** 按当前选中区域筛选列表 */
  applyFilter() {
    const { list, currentDistrict } = this.data
    const filtered = !currentDistrict
      ? (list || [])
      : (list || []).filter((s) => s.district === currentDistrict)
    this.setData({ filteredList: filtered })
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
      uploadingPhotos: false,
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

  onNavigate() {
    const spot = this.data.detail || {}
    navigateSpot({
      name: spot.name,
      navName: spot.navName,
      latitude: spot.latitude,
      longitude: spot.longitude
    })
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

  /** 上传现场照片：选 1~3 张 → 上传 → 走宝藏点位上传接口提交（审核通过前不展示） */
  onUploadPhotos() {
    if (!requireLogin()) return
    const spot = this.data.detail || ({} as GuideSpot)
    if (!spot.id || this.data.uploadingPhotos) return
    chooseImages(MAX_UPLOAD_PHOTOS)
      .then((list) => {
        this.setData({ uploadingPhotos: true })
        wx.showLoading({ title: '上传中', mask: true })
        return Promise.all(list.map((path) => uploadImage('spot', path)))
          .then((uploadIds) => contentApi.createSpot({
            name: spot.name,
            address: [spot.city, spot.district].filter(Boolean).join(' '),
            lat: spot.latitude,
            lng: spot.longitude,
            note: spot.observeHint || '',
            photoUploadIds: uploadIds
          }))
      })
      .then(() => {
        wx.hideLoading()
        // 照片要过审才对外展示，这里只致谢并说明状态，不刷新轮播
        wx.showModal({
          title: '感谢上传',
          content: '照片已提交，正在审核中。审核通过后就会显示在这里。',
          showCancel: false,
          confirmText: '我知道了'
        })
      })
      .catch((err: any) => {
        if (err && err.message === 'cancel') return
        wx.hideLoading()
        showError(err, '上传失败')
      })
      .finally(() => this.setData({ uploadingPhotos: false }))
  }
})
