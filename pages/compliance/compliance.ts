type DocLine = {
  label: string
  value: string
}

type DocItem = {
  title: string
  lines: DocLine[]
}

type Doc = {
  title: string
  updated: string
  intro: string
  items: DocItem[]
}

const DOCS: Record<string, Doc> = {
  collection: {
    title: '个人信息收集清单',
    updated: '2026年9月13日',
    intro: '本清单说明追潮记在你使用各项功能时收集的个人信息。我们仅收集实现功能所必需的信息，拒绝授权不影响潮汐查询等基础功能。',
    items: [
      {
        title: '账号标识（微信 OpenID）',
        lines: [
          { label: '用途', value: '创建和识别你的账号，同步观潮记录、成就与探索进度' },
          { label: '方式', value: '你在登录页选择微信登录时，通过微信登录接口自动获取' },
          { label: '必要性', value: '使用登录相关功能时必要' }
        ]
      },
      {
        title: '昵称与头像',
        lines: [
          { label: '用途', value: '在个人主页展示你的身份' },
          { label: '方式', value: '由你在登录页主动填写昵称、选择微信头像后上传' },
          { label: '必要性', value: '可选，不影响核心功能' }
        ]
      },
      {
        title: '精确地理位置',
        lines: [
          { label: '用途', value: '计算到赶海点的距离、展示附近点位的潮汐与天气、记录场地探索路线' },
          { label: '方式', value: '经你单独授权后，通过设备定位接口获取' },
          { label: '必要性', value: '附近点位与探索功能必要；可在手机系统设置中随时关闭' }
        ]
      },
      {
        title: '相机与相册图片',
        lines: [
          { label: '用途', value: '拍照识别潮间带生物、发布动态、设置头像' },
          { label: '方式', value: '由你主动拍照或从相册选择图片后上传' },
          { label: '必要性', value: '可选，拒绝授权不影响潮汐查询' }
        ]
      },
      {
        title: '摄像头扫码结果',
        lines: [
          { label: '用途', value: '在赶海场地扫码解锁探索内容' },
          { label: '方式', value: '由你在探索页主动扫码时获取' },
          { label: '必要性', value: '仅扫码解锁功能需要' }
        ]
      }
    ]
  },
  sdk: {
    title: 'SDK共享清单',
    updated: '2026年9月13日',
    intro: '为实现地图与登录能力，追潮记接入了以下第三方 SDK。我们仅向其提供实现功能所必需的信息。',
    items: [
      {
        title: '腾讯位置服务地图 SDK',
        lines: [
          { label: '提供方', value: '深圳市腾讯计算机系统有限公司' },
          { label: '共享信息', value: '精确位置信息、设备标识信息' },
          { label: '用途', value: '地图渲染、设备定位、点位距离计算' },
          { label: '隐私政策', value: 'https://lbs.qq.com' }
        ]
      },
      {
        title: '微信开放平台登录能力',
        lines: [
          { label: '提供方', value: '深圳市腾讯计算机系统有限公司' },
          { label: '共享信息', value: '微信 OpenID（不含微信号）' },
          { label: '用途', value: '完成微信登录与账号身份识别' },
          { label: '隐私政策', value: 'https://weixin.qq.com/cgi-bin/readtemplate?t=weixin-agreement' }
        ]
      }
    ]
  },
  sensitive: {
    title: '敏感个人信息处理说明',
    updated: '2026年9月13日',
    intro: '以下信息属于敏感个人信息，我们会在取得你的单独同意后才进行处理。',
    items: [
      {
        title: '精确地理位置信息',
        lines: [
          {
            label: '处理说明',
            value: '位置信息属于敏感个人信息，仅在你使用「附近赶海点」与「开始探索」时、经单独授权后收集。探索过程中的路线只保存在本机，结束探索时立即删除经纬度轨迹，服务端仅保留你走过的网格数据。你可以在手机系统设置中随时关闭位置权限，关闭后仅影响定位与探索，不影响潮汐查询。'
          }
        ]
      },
      {
        title: '未满 14 周岁未成年人信息',
        lines: [
          {
            label: '处理说明',
            value: '未成年人使用场地探索功能前，需要监护人阅读并确认同意；我们不收集与功能无关的未成年人信息。监护人可在「我的 - 设置」中随时撤回同意，撤回后探索功能将停止使用。'
          }
        ]
      },
      {
        title: '相册与相机图片',
        lines: [
          {
            label: '处理说明',
            value: '图片可能包含个人敏感内容。我们仅在你主动拍照或从相册选取图片后读取你选定的文件，用于生物识别、动态发布或头像展示，不会在后台扫描你的相册。'
          }
        ]
      }
    ]
  }
}

Page({
  data: {
    doc: DOCS.collection
  },

  onLoad(options: any) {
    const type = (options && options.type) || 'collection'
    const doc = DOCS[type] || DOCS.collection
    wx.setNavigationBarTitle({ title: doc.title })
    this.setData({ doc })
  }
})
