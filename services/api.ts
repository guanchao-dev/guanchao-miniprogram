import { nowISO } from '../utils/format'
import http from '../utils/http'
import { compressForUpload } from '../utils/upload'

function unwrapList(data: any): any[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return data.list || data.items || data.days || data.faqs || data.groups || []
}

function unwrapGear(data: any): any[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.list)) return data.list
  const groups = data.groups || data.items || []
  const out: any[] = []
  groups.forEach((group: any) => {
    const items = group.items || group.list || []
    if (!items.length && (group.name || group.title)) {
      out.push(group)
      return
    }
    items.forEach((item: any) => {
      if (typeof item === 'string') {
        out.push({ name: item, scene: group.scene || group.id, sceneTitle: group.title || group.name })
        return
      }
      out.push(Object.assign({}, item, {
        scene: item.scene || group.scene || group.id,
        sceneTitle: group.title || group.name
      }))
    })
  })
  return out
}

export const authApi = {
  wechatLogin(code: string, clientId?: string) {
    return http.post('/auth/wechat-login', { code, clientId }, { auth: false })
  },
  me() {
    return http.get('/me')
  },
  /** 上传微信头像（chooseAvatar 拿到的临时文件），先本地压缩再传 */
  async updateAvatar(filePath: string) {
    const compressed = await compressForUpload(filePath)
    return http.upload('/me/avatar', compressed)
  },
  updateNickname(nickname: string) {
    return http.post('/me/nickname', { nickname })
  },
  deleteAccount() {
    return http.post('/me/delete', {})
  }
}

export const homeApi = {
  today(params?: Record<string, any>) {
    return http.get('/home/today', params, { auth: false })
  },
  tideCalendar(params?: Record<string, any>) {
    return http.get('/tide/calendar', params, { auth: false })
  },
  quizzes() {
    return http.get('/quizzes', {}, { auth: false })
  },
  quizQuestions(quizId: string) {
    return http.get(`/quizzes/${quizId}/questions`, {}, { auth: false })
  },
  quizSubmit(quizId: string, body: Record<string, any>) {
    return http.post(`/quizzes/${quizId}/submit`, body, { idempotency: true })
  },
  search(keyword: string) {
    return http.get('/search', { keyword, page: 1, pageSize: 20 }, { auth: false })
  }
}

export const contentApi = {
  spots(params?: Record<string, any>) {
    return http.get('/spots', params, { auth: false }).then((data) => ({
      raw: data,
      list: unwrapList(data)
    }))
  },
  spot(id: string) {
    return http.get(`/spots/${id}`, {}, { auth: false })
  },
  gear() {
    return http.get('/gear', {}, { auth: false }).then((data) => ({
      raw: data,
      list: unwrapGear(data)
    }))
  },
  encyclopedia(params?: Record<string, any>) {
    return http.get('/encyclopedia', params, { auth: false }).then((data) => ({
      raw: data,
      list: unwrapList(data)
    }))
  },
  species(id: string) {
    return http.get(`/encyclopedia/${id}`, {}, { auth: false })
  },
  favoriteSpecies(id: string) {
    return http.post(`/encyclopedia/${id}/favorite`, {})
  },
  unfavoriteSpecies(id: string) {
    return http.delete(`/encyclopedia/${id}/favorite`)
  },
  speciesPhotos(speciesId: string) {
    return http.get(`/encyclopedia/${speciesId}/photos`, {}, { auth: false })
  },
  async uploadSpeciesPhoto(speciesId: string, filePath: string) {
    // 先本地压缩再上传，避免传几 MB 的原图
    const compressed = await compressForUpload(filePath)
    return http.upload(`/encyclopedia/${speciesId}/photos`, compressed)
  },
  favorites() {
    return http.get('/encyclopedia/favorites')
  },
  deleteSpeciesPhoto(speciesId: string, photoId: string) {
    return http.delete(`/encyclopedia/${speciesId}/photos/${photoId}`)
  },
  knowledge() {
    return http.get('/knowledge', {}, { auth: false }).then((data) => unwrapList(data))
  },
  /** 首页相关活动（科普 / 研学等），后端未配置时前端使用默认主题 */
  activities() {
    return http.get('/activities', {}, { auth: false }).then((data) => unwrapList(data))
  },
  knowledgeDetail(id: string) {
    return http.get(`/knowledge/${id}`, {}, { auth: false })
  },
  checkins() {
    return http.get('/records/checkins').then((data) => ({
      raw: data,
      list: unwrapList(data)
    }))
  },
  /** 报到签到：提交姓名、学号与约300米精度的位置（表单自带身份，游客可提交） */
  checkin(body: Record<string, any>) {
    return http.post('/records/checkin', body, { auth: false })
  },
  legal() {
    return http.get('/legal/latest', {}, { auth: false })
  },
  faq() {
    return http.get('/help/faq', {}, { auth: false }).then((data) =>
      unwrapList(data).map((item: any, index: number) => ({
        id: item.id || `faq_${index}`,
        q: item.q || item.question || item.title || '',
        a: item.a || item.answer || item.content || ''
      }))
    )
  },
  feedback(body: Record<string, any>) {
    return http.post('/help/feedback', body)
  },
  guardianConsent(agreed: boolean, version: string) {
    return http.post('/privacy/guardian-consent', { agreed, version })
  },
  withdrawConsent() {
    return http.post('/privacy/withdraw', {})
  }
}

export const aiApi = {
  tideAdvice(spotId?: string, date?: string) {
    return http.post('/ai/tide-advice', { spotId, date }, { timeout: 25000, auth: false })
  },
  speciesGuess(body: Record<string, any>) {
    return http.post('/ai/species-guess', body, { timeout: 25000, idempotency: true, auth: false })
  },
  speciesGuessDetail(guessId: string) {
    return http.get(`/ai/species-guess/${guessId}`, {}, { auth: false })
  },
  speciesFeedback(guessId: string, body: Record<string, any>) {
    return http.post(`/ai/species-guess/${guessId}/feedback`, body, { auth: false })
  }
}

export const watchApi = {
  start(body: Record<string, any>) {
    return http.post('/watch/sessions', body, { idempotency: true, auth: false })
  },
  addSpecies(id: string, body: Record<string, any>) {
    return http.post(`/watch/sessions/${id}/species`, body, { auth: false })
  },
  end(id: string, body: Record<string, any>) {
    return http.post(`/watch/sessions/${id}/end`, body, { idempotency: true, auth: false })
  },
  list(page = 1, pageSize = 50) {
    return http.get('/watch/records', { page, pageSize }, { auth: false }).then((data) => unwrapList(data))
  },
  detail(id: string) {
    return http.get(`/watch/records/${id}`, {}, { auth: false })
  }
}

export const lightMapApi = {
  list() {
    return http.get('/light-maps', {}, { auth: false }).then((data) => unwrapList(data))
  },
  detail(mapId: string) {
    return http.get(`/light-maps/${mapId}`, {}, { auth: false })
  },
  visit(mapId: string, body: Record<string, any>) {
    return http.post(`/light-maps/${mapId}/visits`, body, { auth: false })
  },
  progress(mapId: string) {
    return http.get(`/light-maps/${mapId}/progress`, {}, { auth: false })
  }
}

export const cardApi = {
  create(body: Record<string, any>) {
    return http.post('/cards', body, { timeout: 25000, idempotency: true })
  },
  list(page = 1, pageSize = 20) {
    return http.get('/cards', { page, pageSize })
  },
  detail(cardId: string) {
    return http.get(`/cards/${cardId}`)
  },
  favorite(cardId: string) {
    return http.post(`/cards/${cardId}/favorite`, {})
  },
  unfavorite(cardId: string) {
    return http.delete(`/cards/${cardId}/favorite`)
  },
  remove(cardId: string) {
    return http.delete(`/cards/${cardId}`)
  },
  share(cardId: string, channel = 'wechatFriend') {
    return http.post(`/cards/${cardId}/share`, { channel })
  }
}

export const exploreApi = {
  venue(venueId: string) {
    return http.get(`/explore/venues/${venueId}`, {}, { auth: false })
  },
  submit(body: Record<string, any>) {
    return http.post('/explore/sessions', body, { idempotency: true })
  },
  qrUnlock(code: string) {
    return http.post('/explore/qr-unlock', { code }, { idempotency: true })
  },
  share(sessionId: string) {
    return http.get(`/explore/sessions/${sessionId}/share`)
  }
}

export const achieveApi = {
  overview() {
    return http.get('/achievements/overview', {}, { auth: false })
  },
  medals() {
    return http.get('/medals', {}, { auth: false })
  },
  medal(medalId: string) {
    return http.get(`/medals/${medalId}`, {}, { auth: false })
  },
  shareMedal(medalId: string) {
    return http.post(`/medals/${medalId}/share`, { channel: 'wechatFriend' })
  },
  pendingUnlocks() {
    // 不缓存：解锁回执要即时反映，缓存会让弹窗延迟
    return http.get('/achievements/pending-unlocks', {}, { auth: false, cacheTtl: 0 })
  },
  ackUnlock(medalId: string, source = 'pending') {
    return http.post(`/medals/${medalId}/unlock-ack`, {
      source,
      clientTime: nowISO()
    }, { idempotency: true, auth: false })
  },
  friends() {
    return http.get('/achievements/friends', {}, { auth: false })
  },
  leaderboard() {
    return http.get('/achievements/leaderboard', { limit: 10 }, { auth: false })
  }
}

export const reminderApi = {
  /** 设提醒：remindAt 形如 '2026-09-11T08:00'（北京时间） */
  create(body: Record<string, any>) {
    return http.post('/reminders', body, { idempotency: true })
  },
  list() {
    return http.get('/reminders', {}, { cacheTtl: 0 })
  },
  remove(id: string) {
    return http.delete(`/reminders/${id}`)
  }
}
