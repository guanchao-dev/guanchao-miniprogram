import { toast } from './format'

type NavTarget = {
  /** 展示的点位名 */
  name?: string
  /** 实际导航目的地名（停车场等），缺省用 name */
  navName?: string
  latitude?: number
  longitude?: number
}

/**
 * 拉起微信内置地图查看点位。
 * 微信内置地图会自动调起手机上已装的地图 App（含高德），用户可在系统层选择用高德打开。
 */
export function openSpotMap(lat: number, lng: number, name: string, address?: string): void {
  if (!lat || !lng) {
    toast('点位坐标缺失')
    return
  }
  wx.openLocation({
    latitude: lat,
    longitude: lng,
    name: name || '赶海点位',
    address: address || '',
    scale: 18,
    fail: () => toast('打开地图失败')
  })
}

/**
 * 复制高德地图 H5 链接到剪贴板，用户可去浏览器粘贴打开、调起高德 App。
 * 因微信 web-view 业务域名无法放 amap.com 校验文件，无法在 web-view 里直接加载，
 * 这是 mp 限制下的兜底方案。
 */
export function copyAmapLink(lat: number, lng: number, name: string): void {
  if (!lat || !lng) {
    toast('点位坐标缺失')
    return
  }
  const url = `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(name || '赶海点位')}&callnative=1`
  wx.setClipboardData({
    data: url,
    success: () => toast('高德链接已复制，去浏览器粘贴打开')
  })
}

/**
 * 赶海点位的统一导航入口：
 * 1) 微信内置地图（点导航可转高德/百度/腾讯 App，最常用）
 * 2) 复制高德地图链接（浏览器打开可调起高德 App）
 * 3) 复制地点名称（坐标不准时，去高德搜索精确地点）
 */
export function navigateSpot(target: NavTarget): void {
  const destName = target.navName || target.name || '赶海点位'
  const lat = Number(target.latitude)
  const lng = Number(target.longitude)
  const hasCoord = !!lat && !!lng && !Number.isNaN(lat) && !Number.isNaN(lng)

  if (!hasCoord) {
    // 没有坐标：直接让用户复制地名去地图 App 搜
    wx.setClipboardData({
      data: destName,
      success: () => toast('地点名已复制，去高德地图粘贴搜索')
    })
    return
  }

  wx.showActionSheet({
    itemList: ['地图导航（高德/百度/腾讯）', '复制高德地图链接', '复制地点名称'],
    success: (res) => {
      if (res.tapIndex === 0) {
        openSpotMap(lat, lng, destName)
      } else if (res.tapIndex === 1) {
        copyAmapLink(lat, lng, destName)
      } else if (res.tapIndex === 2) {
        wx.setClipboardData({
          data: destName,
          success: () => toast('地点名已复制')
        })
      }
    }
  })
}
