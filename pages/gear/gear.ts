import { contentApi } from '../../services/api'
import { showError } from '../../utils/format'

Page({
  data: {
    scene: '',
    scenes: [
      { id: '', name: '全部' },
      { id: 'rocky', name: '礁石' },
      { id: 'mudflat', name: '泥滩' },
      { id: 'sandy', name: '沙滩' }
    ],
    all: [],
    list: []
  },

  onShow() {
    this.load()
  },

  onScene(e: any) {
    this.setData({ scene: e.currentTarget.dataset.id || '' })
    this.applyFilter()
  },

  load() {
    contentApi.gear()
      .then((res) => {
        this.setData({ all: res.list || [] })
        this.applyFilter()
      })
      .catch((err) => showError(err, '装备加载失败'))
  },

  applyFilter() {
    const scene = this.data.scene
    const all: any[] = this.data.all || []
    const list = scene
      ? all
          .filter((item) => item.scene === scene || (item.scenes || []).indexOf(scene) >= 0)
          .map((item) => Object.assign({}, item, { isMust: (item.mustHave || []).indexOf(scene) >= 0 }))
      : all.map((item) => Object.assign({}, item, { isMust: false }))
    this.setData({ list })
  }
})
