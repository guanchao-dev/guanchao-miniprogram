import { contentApi } from '../../services/api'
import { toast } from '../../utils/format'
import {
  getRegion,
  getRegionKey,
  getSavedSpotId,
  regionKeyOfCity,
  REGIONS,
  RegionKey,
  setRegionKey
} from '../../utils/region'
import { requestLocation } from '../../utils/spotGuide'

const REGION_DESC: Record<RegionKey, string> = {
  qingdao: '青岛 · 石老人等赶海点',
  hainan: '陵水 · 海口 · 三亚'
}

/**
 * 地区切换页：青岛 / 海南二选一，也可用定位自动匹配。
 * 写入地区后直接返回首页，首页 onShow 会按新地区重新加载潮汐与推荐。
 */
Page({
  data: {
    regionKey: 'qingdao' as RegionKey,
    locating: false,
    regions: [] as Array<{ key: RegionKey; label: string; desc: string }>
  },

  onLoad() {
    this.setData({
      regionKey: getRegionKey(),
      regions: (['qingdao', 'hainan'] as RegionKey[]).map((key) => ({
        key,
        label: REGIONS[key].label,
        desc: REGION_DESC[key]
      }))
    })
  },

  onPickRegion(e: any) {
    const key = e.currentTarget.dataset.key as RegionKey
    if (!REGIONS[key]) return
    if (key === getRegionKey()) {
      wx.navigateBack()
      return
    }
    this.applyRegion(key)
  },

  /** 写入地区并同步全局点位，返回首页后由其 onShow 重新加载 */
  applyRegion(key: RegionKey) {
    setRegionKey(key)
    const app = getApp()
    if (app.globalData) app.globalData.spotId = getSavedSpotId()
    toast(`已切换到${getRegion().label}版本`)
    wx.navigateBack()
  },

  /** 定位后按城市自动匹配地区：青岛 → 青岛版，陵水/海口/三亚 → 海南版 */
  useCurrentLocation() {
    if (this.data.locating) return
    this.setData({ locating: true })
    requestLocation(true)
      .then((loc) => {
        if (!loc) {
          this.guideOpenSetting()
          return
        }
        return contentApi.resolveCity(loc.lat, loc.lng).then((geo: any) => {
          const city = (geo && geo.city) || ''
          const key = regionKeyOfCity(city)
          if (!key) {
            toast(`暂未开放${city || '该地区'}`)
            return
          }
          if (key === getRegionKey()) {
            toast(`当前已是${getRegion().label}版本`)
            wx.navigateBack()
            return
          }
          this.applyRegion(key)
        })
      })
      .catch(() => toast('定位失败，请稍后重试'))
      .finally(() => this.setData({ locating: false }))
  },

  /** 用户拒绝过授权后微信不会再弹窗，只能引导去设置页手动开启 */
  guideOpenSetting() {
    wx.getSetting({
      success: (res: any) => {
        if (res.authSetting['scope.userLocation'] === false) {
          wx.showModal({
            title: '需要位置权限',
            content: '开启后才能自动匹配你所在的地区，是否前往设置？',
            confirmText: '去设置',
            success: (r: any) => {
              if (r.confirm) wx.openSetting({})
            }
          })
          return
        }
        toast('定位失败，请稍后重试')
      }
    })
  }
})
