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
  /**
   * 按坐标反查城市 / 区，首页顶部「当前城市」显示用。
   * 走服务端反查（不是小程序直连地图服务），省得再配域名白名单。
   */
  resolveCity(lat: number, lng: number) {
    return http.get('/geo/city', { lat, lng }, { auth: false })
  },
  /** 「宝藏地点」：用户投稿、管理员审核通过后发布出来的点位（不含官方策展点位）。 */
  treasureSpots(params?: Record<string, any>) {
    return http.get('/spots/treasure', params, { auth: false }).then((data) => ({
      raw: data,
      list: unwrapList(data)
    }))
  },
  spot(id: string) {
    return http.get(`/spots/${id}`, {}, { auth: false })
  },
  /**
   * 用户上传宝藏赶海点位。
   * 失败时抛错，交给页面提示「提交失败」——不再伪造一个成功结果，
   * 否则用户以为传上去了，实际服务端没有。
   */
  createSpot(payload: Record<string, any>) {
    return http.post('/spots', payload)
  },
  /**
   * 当前用户上传过的点位。
   * 失败时向上抛错 —— 调用方要能区分「接口挂了」和「确实没有点位」，
   * 否则接口一失败就会被当成空列表，错误地回退到本地缓存。
   */
  mySpots() {
    return http.get('/spots/mine').then((data) => ({ raw: data, list: unwrapList(data) }))
  },
  /** 删除自己上传的点位。后端只允许删自己的，别人的一律返回 404。 */
  deleteSpot(id: string) {
    return http.delete(`/spots/${id}`)
  },
  gear() {
    return http.get('/gear', {}, { auth: false }).then((data) => ({
      raw: data,
      list: unwrapGear(data)
    }))
  },
  /**
   * 图鉴列表。返回项带 lit 字段（是否已点亮）。
   *
   * ⚠️ 这里的 auth: false 必须与 watchApi.addSpecies 保持一致：两边都用游客身份
   * client:{id} 归档。若改成 auth: true，点亮会记在 user:{id} 下、列表按 client:{id}
   * 查，图鉴将永远点不亮。（观潮记录本身就是 client 归属，addSpecies 不能改。）
   *
   * cacheTtl: 0 —— 点亮后回到图鉴必须立刻可见，不能等 60 秒缓存过期。
   */
  encyclopedia(params?: Record<string, any>) {
    return http.get('/encyclopedia', params, { auth: false, cacheTtl: 0 }).then((data) => ({
      raw: data,
      list: unwrapList(data)
    }))
  },
  /**
   * 我点亮的图鉴物种 + 总数（图鉴页进度条用）。
   * 返回里的 newSpeciesIds 是「刚点亮、还没在图鉴里看过」的，只给它们加闪光。
   * 身份同上，必须 auth: false。
   */
  encyclopediaUnlocked() {
    return http.get('/encyclopedia/unlocked', {}, { auth: false, cacheTtl: 0 })
  },
  /** 把图鉴里已经展示过的新物种标记为「看过了」，之后不再闪光。幂等。 */
  markSpeciesSeen(speciesIds: string[]) {
    return http.post('/encyclopedia/seen', { speciesIds }, { auth: false })
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
  /** 我的报到记录 */
  reportCheckins(page = 1, pageSize = 20) {
    return http.get('/records/report-checkins', { page, pageSize }, { auth: false })
      .then((data) => ({
        raw: data,
        list: unwrapList(data)
      }))
  },
  // ===== 签到活动（组织者建围栏 + 参与者凭密钥签到）=====
  /** 创建签到活动，返回 6 位密钥 */
  createCheckinSession(body: Record<string, any>) {
    return http.post('/checkin-sessions', body, { auth: false })
  },
  /** 按密钥查活动信息（参与者验证用） */
  checkinSessionByKey(key: string) {
    return http.get(`/checkin-sessions/by-key/${encodeURIComponent(key)}`, {}, { auth: false })
  },
  /** 我发起的签到活动 */
  myCheckinSessions() {
    return http.get('/checkin-sessions/mine', {}, { auth: false })
      .then((data) => ({ raw: data, list: unwrapList(data) }))
  },
  /** 某个签到的报到名单（仅创建者） */
  checkinSessionRecords(sessionId: string) {
    return http.get(`/checkin-sessions/${sessionId}/records`, {}, { auth: false })
  },
  /** 结束签到 */
  closeCheckinSession(sessionId: string) {
    return http.post(`/checkin-sessions/${sessionId}/close`, {}, { auth: false })
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
  /**
   * 我的消息（管理员对我反馈的回复）。需要登录。
   * cacheTtl=0：不能走 60 秒 GET 缓存 —— 缓存会让「铃铛有红点、点进去却是空的」
   * 同时出现（红点走的 unread 接口是不缓存的，两个接口对不上）。
   */
  notifications(params?: Record<string, any>) {
    return http.get('/me/notifications', params, { cacheTtl: 0 })
  },
  /** 未读消息数（铃铛上的红点）。cacheTtl=0：红点要实时，不能被 60 秒缓存挡住 */
  notificationsUnread() {
    return http.get('/me/notifications/unread', {}, { cacheTtl: 0 })
  },
  /** 标记消息已读；不传 ids 就全部标记 */
  markNotificationsRead(ids?: string[]) {
    return http.post('/me/notifications/read', ids && ids.length ? { ids } : {})
  },
  guardianConsent(agreed: boolean, version: string) {
    return http.post('/privacy/guardian-consent', { agreed, version })
  },
  withdrawConsent() {
    return http.post('/privacy/withdraw', {})
  }
}

export const aiApi = {
  /**
   * 出行建议：传用户当前坐标，后端返回推荐赶海时间、离场时间与推荐地点。
   * 不适合赶海时 bestTimeFrom/bestTimeTo/recommendedSpot 均为 null。
   */
  tideAdvice(lat?: number, lng?: number, date?: string, spotId?: string) {
    const body: Record<string, any> = {}
    if (lat != null && lng != null) {
      body.lat = lat
      body.lng = lng
    } else if (spotId) {
      body.spotId = spotId
    }
    if (date) body.date = date
    return http.post('/ai/tide-advice', body, { timeout: 25000, auth: false })
  },
  speciesGuess(body: Record<string, any>) {
    return http.post('/ai/species-guess', body, { timeout: 25000, idempotency: true, auth: false })
  },
  /** 垃圾识别：识出是什么垃圾 + 属于哪一类 */
  trashGuess(body: Record<string, any>) {
    return http.post('/ai/trash-guess', body, { timeout: 25000, auth: false })
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
  /**
   * 排行榜。
   * @param scope 'all' 全站榜 / 'friends' 我关注的人
   */
  leaderboard(params?: Record<string, any>) {
    return http.get('/achievements/leaderboard', Object.assign(
      { scope: 'all', page: 1, pageSize: 20 },
      params || {}
    ), { auth: false })
  }
}

export const userApi = {
  /** 关注某个用户（用于「好友榜」） */
  follow(userId: string) {
    return http.post(`/users/${userId}/follow`, {})
  },
  unfollow(userId: string) {
    return http.delete(`/users/${userId}/follow`)
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
