import { DEFAULT_SPOT_ID } from './config/env'
import { getUser, isLoggedIn } from './utils/auth'
import { preloadOnLaunch } from './utils/preload'
import { getRegionKey, getSavedSpotId } from './utils/region'

App({
  globalData: {
    // 青岛保留默认点位，海南首次进入时等页面按城市解析出真实点位
    spotId: getSavedSpotId() || (getRegionKey() === 'qingdao' ? DEFAULT_SPOT_ID : '')
  },

  onLaunch() {
    this.globalData.loggedIn = isLoggedIn()
    this.globalData.user = getUser()
    // 冷启动清除上次未结束的赶海会话：小程序被杀掉/重编译后，
    // 残留的 watchSession 会让首页误显示“赶海中”，启动时一律复位。
    try {
      wx.removeStorageSync('watchSession')
    } catch (e) {}
    // 启动即开始并行预加载各二级页面数据（潮汐表、日历、图鉴…），
    // 与首页自身的请求、图片加载并行推进。
    preloadOnLaunch(this.globalData.spotId)
  }
})
