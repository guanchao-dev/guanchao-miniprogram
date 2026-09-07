import { nowISO } from '../utils/format'
import http from '../utils/http'
import {
  mockAddComment,
  mockComments,
  mockCreate,
  mockFeed,
  mockFollow,
  mockHot,
  mockNote,
  mockSearch,
  mockSuggest,
  mockToggleFavorite,
  mockToggleLike,
  mockTopics,
  mockUser
} from './communityMock'

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
  wechatLogin(code: string) {
    return http.post('/auth/wechat-login', { code }, { auth: false })
  },
  me() {
    return http.get('/me')
  },
  deleteAccount() {
    return http.post('/me/delete', {})
  }
}

export const homeApi = {
  today(params?: Record<string, any>) {
    return http.get('/home/today', params, { auth: true })
  },
  tideCalendar(params?: Record<string, any>) {
    return http.get('/tide/calendar', params, { auth: true })
  },
  quizzes() {
    return http.get('/quizzes', {}, { auth: true })
  },
  quizQuestions(quizId: string) {
    return http.get(`/quizzes/${quizId}/questions`, {}, { auth: true })
  },
  quizSubmit(quizId: string, body: Record<string, any>) {
    return http.post(`/quizzes/${quizId}/submit`, body, { idempotency: true })
  }
}

export const contentApi = {
  spots(params?: Record<string, any>) {
    return http.get('/spots', params, { auth: true }).then((data) => ({
      raw: data,
      list: unwrapList(data)
    }))
  },
  spot(id: string) {
    return http.get(`/spots/${id}`, {}, { auth: true })
  },
  gear() {
    return http.get('/gear', {}, { auth: true }).then((data) => ({
      raw: data,
      list: unwrapGear(data)
    }))
  },
  encyclopedia(params?: Record<string, any>) {
    return http.get('/encyclopedia', params, { auth: true }).then((data) => ({
      raw: data,
      list: unwrapList(data)
    }))
  },
  species(id: string) {
    return http.get(`/encyclopedia/${id}`, {}, { auth: true })
  },
  favoriteSpecies(id: string) {
    return http.post(`/encyclopedia/${id}/favorite`, {})
  },
  unfavoriteSpecies(id: string) {
    return http.delete(`/encyclopedia/${id}/favorite`)
  },
  speciesPhotos(speciesId: string) {
    return http.get(`/encyclopedia/${speciesId}/photos`, {}, { auth: true })
  },
  uploadSpeciesPhoto(speciesId: string, filePath: string) {
    return http.upload(`/encyclopedia/${speciesId}/photos`, filePath)
  },
  deleteSpeciesPhoto(speciesId: string, photoId: string) {
    return http.delete(`/encyclopedia/${speciesId}/photos/${photoId}`)
  },
  checkins() {
    return http.get('/records/checkins').then((data) => ({
      raw: data,
      list: unwrapList(data)
    }))
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
    return http.post('/ai/tide-advice', { spotId, date }, { timeout: 25000 })
  },
  speciesGuess(body: Record<string, any>) {
    return http.post('/ai/species-guess', body, { timeout: 25000, idempotency: true })
  },
  speciesGuessDetail(guessId: string) {
    return http.get(`/ai/species-guess/${guessId}`)
  },
  speciesFeedback(guessId: string, body: Record<string, any>) {
    return http.post(`/ai/species-guess/${guessId}/feedback`, body)
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

function fallback(err: any, mockFn: () => any) {
  if (err && err.code === 40101) throw err
  return mockFn()
}

export const communityApi = {
  topics() {
    return http.get('/community/topics', {}, { auth: true })
      .then((data) => ({ list: unwrapList(data) }))
      .catch((err) => fallback(err, mockTopics))
  },
  feed(params?: Record<string, any>) {
    return http.get('/community/feed', params, { auth: true })
      .then((data) => ({
        list: unwrapList(data),
        page: data && data.page,
        total: data && data.total
      }))
      .catch((err) => fallback(err, () => mockFeed(params)))
  },
  hotKeywords() {
    return http.get('/community/search/hot', {}, { auth: false })
      .then((data) => ({ list: unwrapList(data) }))
      .catch((err) => fallback(err, mockHot))
  },
  suggest(keyword: string) {
    return http.get('/community/search/suggest', { keyword }, { auth: false })
      .then((data) => ({ list: unwrapList(data) }))
      .catch((err) => fallback(err, () => mockSuggest(keyword)))
  },
  search(params: Record<string, any>) {
    return http.get('/community/search', params, { auth: true })
      .catch((err) => fallback(err, () => mockSearch(params)))
  },
  note(id: string) {
    return http.get(`/community/notes/${id}`, {}, { auth: true })
      .catch((err) => fallback(err, () => mockNote(id)))
  },
  createNote(body: Record<string, any>) {
    return http.post('/community/notes', body, { idempotency: true, timeout: 25000 })
      .catch((err) => fallback(err, () => mockCreate(body)))
  },
  like(id: string) {
    return http.post(`/community/notes/${id}/like`, {})
      .catch((err) => fallback(err, () => mockToggleLike(id)))
  },
  unlike(id: string) {
    return http.delete(`/community/notes/${id}/like`)
      .catch((err) => fallback(err, () => mockToggleLike(id)))
  },
  favorite(id: string) {
    return http.post(`/community/notes/${id}/favorite`, {})
      .catch((err) => fallback(err, () => mockToggleFavorite(id)))
  },
  unfavorite(id: string) {
    return http.delete(`/community/notes/${id}/favorite`)
      .catch((err) => fallback(err, () => mockToggleFavorite(id)))
  },
  comments(id: string) {
    return http.get(`/community/notes/${id}/comments`, { page: 1, pageSize: 50 }, { auth: true })
      .then((data) => ({ list: unwrapList(data) }))
      .catch((err) => fallback(err, () => mockComments(id)))
  },
  addComment(id: string, content: string) {
    return http.post(`/community/notes/${id}/comments`, { content }, { idempotency: true })
      .catch((err) => fallback(err, () => mockAddComment(id, content)))
  },
  follow(userId: string) {
    return http.post(`/community/users/${userId}/follow`, {})
      .catch((err) => fallback(err, () => mockFollow(userId, true)))
  },
  unfollow(userId: string) {
    return http.delete(`/community/users/${userId}/follow`)
      .catch((err) => fallback(err, () => mockFollow(userId, false)))
  },
  user(userId: string, tab = 'notes') {
    return http.get(`/community/users/${userId}`, { tab, page: 1, pageSize: 50 }, { auth: true })
      .catch((err) => fallback(err, () => mockUser(userId, tab)))
  }
}

export const exploreApi = {
  venue(venueId: string) {
    return http.get(`/explore/venues/${venueId}`, {}, { auth: true })
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
    return http.get('/achievements/overview')
  },
  medals() {
    return http.get('/medals')
  },
  medal(medalId: string) {
    return http.get(`/medals/${medalId}`)
  },
  shareMedal(medalId: string) {
    return http.post(`/medals/${medalId}/share`, { channel: 'wechatFriend' })
  },
  pendingUnlocks() {
    return http.get('/achievements/pending-unlocks')
  },
  ackUnlock(medalId: string, source = 'pending') {
    return http.post(`/medals/${medalId}/unlock-ack`, {
      source,
      clientTime: nowISO()
    }, { idempotency: true })
  },
  friends() {
    return http.get('/achievements/friends')
  }
}
