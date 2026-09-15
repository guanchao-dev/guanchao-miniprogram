Page({
  data: {
    version: '0.1.0 测试版',
    features: [
      { title: '潮汐表', desc: '查看附近赶海点的实时潮高与涨退潮' },
      { title: '潮汐日历', desc: '按月浏览高潮低潮，安排赶海行程' },
      { title: '海洋图鉴', desc: '认识潮间带常见生物，拍照即可识别' },
      { title: '知识科普', desc: '一条一条积累赶海常识与海洋素养' },
      { title: '探索打卡', desc: '在赶海场地驱散迷雾网格，记录探索足迹' }
    ]
  },

  goLegal() {
    wx.navigateTo({ url: '/pages/legal/legal' })
  }
})
