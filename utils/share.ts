/** 开启右上角转发菜单（好友 + 朋友圈），各页面在 onShow 调用 */
export function enableShareMenu(): void {
  if (!wx.showShareMenu) return
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline']
  })
}
