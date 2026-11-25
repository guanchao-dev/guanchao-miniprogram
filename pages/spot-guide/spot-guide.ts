import { homeApi } from '../../services/api'
import { trendText } from '../../utils/format'
import { GuideSpot, loadGuideSpots } from '../../utils/spotGuide'
import { getRegion } from '../../utils/region'
import { navigateSpot } from '../../utils/amapNav'

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
    tideSummary: '正在读取今日潮汐…'
  },

  onShow() {
    wx.setNavigationBarTitle({ title: `${getRegion().label}赶海点` })
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
    this.setData({
      showDetail: true,
      detail,
      tideSummary: '正在读取今日潮汐…'
    })
    this.loadTideSummary(detail)
  },

  /** 弹层只留一句今日潮汐，完整潮汐与物种信息在详情页 */
  loadTideSummary(spot: GuideSpot) {
    homeApi.today({ spotId: spot.id })
      .then((data) => {
        const tide = (data && data.tide) || {}
        const height = tide.currentHeightM != null ? tide.currentHeightM : ''
        const summary = height !== ''
          ? `现在约 ${height}m · ${trendText(tide.trend)}`
          : '潮汐仅供参考，请以现场公示为准'
        // 用户可能已经关掉或切换到别的点位，旧结果不要覆盖
        if (!this.data.showDetail || this.data.detail.id !== spot.id) return
        this.setData({ tideSummary: summary })
      })
      .catch(() => {
        if (!this.data.showDetail || this.data.detail.id !== spot.id) return
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

  /** 完整信息（照片、涨退潮表、生物、安全提示）都在详情页 */
  goDetail() {
    const id = this.data.detail.id
    if (!id) return
    this.setData({ showDetail: false })
    wx.navigateTo({ url: `/pages/spot-detail/spot-detail?id=${id}` })
  },

  noop() {}
})
