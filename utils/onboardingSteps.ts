/**
 * 新手教程步骤：锚点气泡引导，支持跨 tab 页。
 * selector 为当前页面 WXML 上的锚点 id；null 表示无锚点居中卡片。
 * tab 标记该步所属的页面，跨页时由页面层 switchTab 续接。
 */
export type OnboardingStep = {
  selector?: string | null
  title: string
  desc: string
  /** 该步所属 tab 页：home / achieve / profile */
  tab?: 'home' | 'achieve' | 'profile'
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    selector: null,
    tab: 'home',
    title: '嗨，我是泡泡',
    desc: '欢迎来到追潮记！我是你的赶海小伙伴。接下来带你认识几个关键功能，很快就好～'
  },
  {
    selector: '#onb-watch',
    tab: 'home',
    title: '一键开始观潮',
    desc: '点这里选好赶海地点，开始计时。结束后自动生成记录，还会出现悬浮球陪你探索。'
  },
  {
    selector: '#onb-spots',
    tab: 'home',
    title: '赶海地点推荐',
    desc: '按距离和热度推荐周边赶海点。点进去看今日潮汐、安全提示，还能一键导航到停车场。'
  },
  {
    selector: '#onb-photo',
    tab: 'home',
    title: '拍照识别生物',
    desc: '拍下小螃蟹、贝壳、海星，AI 帮你认出种类和习性，慢慢建立你的海洋图鉴。'
  },
  {
    selector: '#onb-trash',
    tab: 'home',
    title: '生态净滩',
    desc: '拍到海滩上的垃圾，AI 按国家四分类告诉你怎么正确投放，一起守护这片海。'
  },
  {
    selector: '#onb-advice',
    tab: 'home',
    title: '出门建议',
    desc: '我会根据今日潮汐，告诉你最佳赶海时段、要带什么装备，还有重要的安全提醒。'
  },
  {
    selector: '#onb-activity',
    tab: 'home',
    title: '海洋活动',
    desc: '科普课、研学营和海洋行动都在这张轮播图里，点卡片就能直达参加。'
  },
  {
    selector: null,
    tab: 'achieve',
    title: '你的成就',
    desc: '每次观潮的记录和获得的徽章都在「成就」页。坚持赶海，解锁更多图鉴和称号！'
  },
  {
    selector: '#onb-spot-entry',
    tab: 'profile',
    title: '宝藏点位',
    desc: '在这里上传你的私藏赶海点位，下次出发一键导航不迷路。图鉴和个人设置也在本页。'
  },
  {
    selector: null,
    tab: 'home',
    title: '准备好出发了吗？',
    desc: '该认识的都认识啦。潮汐不等人，跟我一起去海滩吧！'
  }
]
