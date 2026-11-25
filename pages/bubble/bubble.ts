const DIALOGS = [
  '今天的潮水很温柔，适合去踩水。',
  '退潮后的小水洼里，藏着好多小秘密。',
  '据说对着海螺说话，海会记住你的愿望。',
  '嘿，你鞋里进沙子了吗？',
  '赶海前记得看潮汐表，我替你把时间盯好。',
  '我最喜欢退潮前的那阵风，凉凉的。',
  '别走太快呀，好看的贝壳都在脚边。'
]

const AFFINITY_KEY = 'bubble_affinity'

Page({
  animTimer: 0 as any,
  burstTimer: 0 as any,

  data: {
    dialog: '嗨，我是泡泡！追潮记里的海洋向导，今天也一起去看海吗？',
    mood: 'idle',
    anim: '',
    burst: false,
    affinity: 0
  },

  onLoad() {
    const saved = Number(wx.getStorageSync(AFFINITY_KEY) || 0)
    this.setData({ affinity: Math.min(100, Math.max(0, saved)) })
  },

  onUnload() {
    if (this.animTimer) clearTimeout(this.animTimer)
    if (this.burstTimer) clearTimeout(this.burstTimer)
  },

  onTapBubble() {
    const line = DIALOGS[Math.floor(Math.random() * DIALOGS.length)]
    this.react(line, 'happy', 1)
  },

  onPat() {
    this.react('嘿嘿，头发要被你揉乱啦。', 'shy', 2)
  },

  onFeed() {
    this.react('小鱼干！那我给你讲讲今天的潮汐吧。', 'happy', 5)
  },

  onSong() {
    this.react('浪花跟着节奏，一涨一退，你也来试试。', 'happy', 3)
  },

  /** 统一处理互动：换台词、加默契值、触发弹跳和光点 */
  react(dialog: string, mood: string, add: number) {
    const affinity = Math.min(100, this.data.affinity + add)
    wx.setStorageSync(AFFINITY_KEY, affinity)
    this.setData({ dialog, mood, affinity, anim: 'bounce', burst: true })
    wx.vibrateShort({ type: 'light' } as any)

    if (this.animTimer) clearTimeout(this.animTimer)
    this.animTimer = setTimeout(() => this.setData({ anim: '' }), 520)

    if (this.burstTimer) clearTimeout(this.burstTimer)
    this.burstTimer = setTimeout(() => this.setData({ burst: false, mood: 'idle' }), 900)
  }
})
