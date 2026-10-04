Page({
  openDoc(e: any) {
    const type = e.currentTarget.dataset.type
    if (!type) return
    wx.navigateTo({ url: `/pages/legal-detail/legal-detail?type=${type}` })
  }
})
