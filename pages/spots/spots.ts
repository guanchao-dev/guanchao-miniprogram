/**
 * 旧的「附近赶海点」入口，保留路径以兼容历史分享链接。
 * 点位列表统一由 spot-guide 提供，这里直接重定向过去。
 */
Page({
  onLoad() {
    wx.redirectTo({ url: '/pages/spot-guide/spot-guide' })
  }
})
