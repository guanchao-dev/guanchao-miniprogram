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
    desc: '带你快速认识追潮记'
  },
  {
    selector: '#onb-watch',
    tab: 'home',
    title: '开始观潮',
    desc: '选好地点，一键计时'
  },
  {
    selector: '#onb-spots',
    tab: 'home',
    title: '地点推荐',
    desc: '热门赶海点一键导航'
  },
  {
    selector: '#onb-photo',
    tab: 'home',
    title: '拍照识别',
    desc: 'AI 帮你认生物建图鉴'
  },
  {
    selector: '#onb-trash',
    tab: 'home',
    title: '生态净滩',
    desc: '垃圾四分类守护海洋'
  },
  {
    selector: '#onb-advice',
    tab: 'home',
    title: '出门建议',
    desc: '潮汐天气安全提醒'
  },
  {
    selector: '#onb-activity',
    tab: 'home',
    title: '海洋活动',
    desc: '科普研学报名参加'
  },
  {
    selector: null,
    tab: 'achieve',
    title: '你的成就',
    desc: '观潮记录徽章都在这里'
  },
  {
    selector: '#onb-spot-entry',
    tab: 'profile',
    title: '宝藏点位',
    desc: '上传私藏点位一键导航'
  },
  {
    selector: null,
    tab: 'home',
    title: '出发吧！',
    desc: '潮汐不等人，去海滩吧'
  }
]
