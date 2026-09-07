import { getUser } from '../utils/auth'
import { nowISO } from '../utils/format'

export const TOPICS = [
  { id: '', name: '全部', noteCount: 0 },
  { id: 'topic_lowtide', name: '退潮观察', noteCount: 128 },
  { id: 'topic_rocky', name: '礁石生物', noteCount: 86 },
  { id: 'topic_safety', name: '安全赶海', noteCount: 54 },
  { id: 'topic_gear', name: '装备分享', noteCount: 33 },
  { id: 'topic_wiki', name: '图鉴对照', noteCount: 41 }
]

export const HOT_KEYWORDS = [
  { keyword: '藤壶', heat: 98 },
  { keyword: '退潮', heat: 86 },
  { keyword: '防滑鞋', heat: 71 },
  { keyword: '石老人', heat: 60 },
  { keyword: '牡蛎', heat: 52 }
]

const USERS: any[] = [
  {
    id: 'u_10001',
    nickname: '观潮探索者',
    avatarUrl: '/assets/badges/crab-cloud.png',
    level: 6,
    title: '海洋探索家',
    noteCount: 4,
    likeCount: 28,
    favoriteCount: 6,
    followerCount: 12,
    followingCount: 3,
    followed: false
  },
  {
    id: 'u_10002',
    nickname: '礁石观察员',
    avatarUrl: '/assets/badges/crab-map.png',
    level: 12,
    title: '潮间带记录员',
    noteCount: 18,
    likeCount: 260,
    favoriteCount: 40,
    followerCount: 42,
    followingCount: 15,
    followed: true
  },
  {
    id: 'u_10003',
    nickname: '退潮小侦探',
    avatarUrl: '/assets/badges/crab-detective.png',
    level: 8,
    title: '观察新手',
    noteCount: 9,
    likeCount: 74,
    favoriteCount: 11,
    followerCount: 20,
    followingCount: 8,
    followed: false
  }
]

let notes: any[] = [
  {
    id: 'note_1001',
    title: '退潮后礁石上的小房子',
    content: '水位下去以后，礁石上出现一片灰白色小圆锥。用眼睛看就好，不要撬下来。',
    coverUrl: '/assets/home/home-nearby.png',
    coverHeight: 340,
    imageUrls: ['/assets/home/home-nearby.png', '/assets/badges/crab-map.png'],
    topicIds: ['topic_lowtide', 'topic_wiki'],
    spotId: 'spot_qd_shilaoren',
    spotName: '青岛 · 石老人',
    speciesId: 'sp_barnacle',
    speciesName: '藤壶',
    authorId: 'u_10002',
    likeCount: 36,
    commentCount: 2,
    favoriteCount: 12,
    liked: false,
    favorited: false,
    visibility: 'public',
    createdAt: '2026-08-26T09:04:00+08:00',
    disclaimer: '这是观察分享，不是物种鉴定。请对照图鉴，不要采集生物。'
  },
  {
    id: 'note_1002',
    title: '第一次知道要穿防滑鞋',
    content: '礁石湿滑，大人拉着我走才敢靠近水边。帽子和鞋子比小桶重要。',
    coverUrl: '/assets/home/home-gear.png',
    coverHeight: 260,
    imageUrls: ['/assets/home/home-gear.png'],
    topicIds: ['topic_gear', 'topic_safety'],
    spotId: 'spot_qd_shilaoren',
    spotName: '青岛 · 石老人',
    authorId: 'u_10003',
    likeCount: 21,
    commentCount: 1,
    favoriteCount: 7,
    liked: false,
    favorited: false,
    visibility: 'public',
    createdAt: '2026-08-25T16:20:00+08:00',
    disclaimer: '这是观察分享，不是物种鉴定。请对照图鉴，不要采集生物。'
  },
  {
    id: 'note_1003',
    title: '潮间带里的绿色地毯',
    content: '石头缝里铺着一层海藻，退潮后摸起来凉凉的。只看不采。',
    coverUrl: '/assets/home/home-fish.png',
    coverHeight: 300,
    imageUrls: ['/assets/home/home-fish.png'],
    topicIds: ['topic_rocky'],
    spotId: 'spot_qd_shilaoren',
    spotName: '青岛 · 石老人',
    authorId: 'u_10002',
    likeCount: 18,
    commentCount: 0,
    favoriteCount: 5,
    liked: false,
    favorited: false,
    visibility: 'public',
    createdAt: '2026-08-24T11:10:00+08:00',
    disclaimer: '这是观察分享，不是物种鉴定。请对照图鉴，不要采集生物。'
  },
  {
    id: 'note_1004',
    title: '涨潮前提前离开水边',
    content: '老师说看见水位回来就要往高处走。我们把小桶收好，不再往下走。',
    coverUrl: '/assets/home/home-calendar.png',
    coverHeight: 240,
    imageUrls: ['/assets/home/home-calendar.png'],
    topicIds: ['topic_safety'],
    spotId: 'spot_qd_shilaoren',
    spotName: '青岛 · 石老人',
    authorId: 'u_10001',
    likeCount: 44,
    commentCount: 3,
    favoriteCount: 16,
    liked: false,
    favorited: true,
    visibility: 'public',
    createdAt: '2026-08-23T17:40:00+08:00',
    disclaimer: '这是观察分享，不是物种鉴定。请对照图鉴，不要采集生物。'
  },
  {
    id: 'note_1005',
    title: '对照图鉴才敢说「可能是牡蛎」',
    content: '壳一张一张贴在礁石上。小螃蟹说不要只信它，要去图鉴再看一眼。',
    coverUrl: '/assets/badges/crab-book.png',
    coverHeight: 320,
    imageUrls: ['/assets/badges/crab-book.png'],
    topicIds: ['topic_wiki', 'topic_rocky'],
    spotId: 'spot_qd_shilaoren',
    spotName: '青岛 · 石老人',
    speciesId: 'sp_oyster',
    speciesName: '牡蛎',
    authorId: 'u_10003',
    likeCount: 29,
    commentCount: 1,
    favoriteCount: 9,
    liked: true,
    favorited: false,
    visibility: 'public',
    createdAt: '2026-08-22T08:30:00+08:00',
    disclaimer: '这是观察分享，不是物种鉴定。请对照图鉴，不要采集生物。'
  },
  {
    id: 'note_1006',
    title: '今天的潮汐曲线像一座小山',
    content: '首页曲线从低到高再下来。我们选在较低的时候去看石头缝。',
    coverUrl: '/assets/home/home-hero-mascot.png',
    coverHeight: 280,
    imageUrls: ['/assets/home/home-hero-mascot.png'],
    topicIds: ['topic_lowtide'],
    spotId: 'spot_qd_shilaoren',
    spotName: '青岛 · 石老人',
    authorId: 'u_10001',
    likeCount: 15,
    commentCount: 0,
    favoriteCount: 4,
    liked: false,
    favorited: false,
    visibility: 'public',
    createdAt: '2026-08-21T19:00:00+08:00',
    disclaimer: '这是观察分享，不是物种鉴定。请对照图鉴，不要采集生物。'
  }
]

const comments: Record<string, any[]> = {
  note_1001: [
    {
      id: 'cmt_9001',
      content: '我们也看到了，退潮后更清楚。',
      createdAt: '2026-08-26T10:12:00+08:00',
      authorId: 'u_10003',
      replyTo: null
    },
    {
      id: 'cmt_9002',
      content: '记得穿防滑鞋，礁石很滑。',
      createdAt: '2026-08-26T11:02:00+08:00',
      authorId: 'u_10001',
      replyTo: null
    }
  ],
  note_1002: [
    {
      id: 'cmt_9003',
      content: '装备清单里防滑鞋是必带。',
      createdAt: '2026-08-25T18:00:00+08:00',
      authorId: 'u_10002',
      replyTo: null
    }
  ],
  note_1004: [
    {
      id: 'cmt_9004',
      content: '看日历上的涨潮时间再出发。',
      createdAt: '2026-08-23T18:10:00+08:00',
      authorId: 'u_10002',
      replyTo: null
    }
  ]
}

function userById(id: string) {
  return USERS.find((item) => item.id === id) || USERS[0]
}

function topicById(id: string) {
  return TOPICS.find((item) => item.id === id)
}

function currentUser() {
  const cached = getUser() || {}
  return {
    id: cached.id || 'u_10001',
    nickname: cached.nickname || '观潮探索者',
    avatarUrl: cached.avatarUrl || '/assets/badges/crab-cloud.png',
    level: cached.level || 1,
    title: cached.title || '海洋探索家'
  }
}

function cardOf(note: any) {
  const author = userById(note.authorId)
  const topics = (note.topicIds || []).map((id: string) => topicById(id)).filter(Boolean)
  return {
    id: note.id,
    title: note.title,
    coverUrl: note.coverUrl,
    coverHeight: note.coverHeight || 280,
    topics,
    spotName: note.spotName || '',
    author: {
      id: author.id,
      nickname: author.nickname,
      avatarUrl: author.avatarUrl
    },
    likeCount: note.likeCount,
    commentCount: note.commentCount,
    favoriteCount: note.favoriteCount,
    liked: !!note.liked,
    createdAt: note.createdAt
  }
}

function detailOf(note: any) {
  const author = userById(note.authorId)
  const topics = (note.topicIds || []).map((id: string) => topicById(id)).filter(Boolean)
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    imageUrls: note.imageUrls || [note.coverUrl],
    topics,
    spot: note.spotId ? { id: note.spotId, name: note.spotName, city: '青岛' } : null,
    species: note.speciesId ? { id: note.speciesId, name: note.speciesName } : null,
    author: Object.assign({}, author, { me: author.id === currentUser().id }),
    likeCount: note.likeCount,
    commentCount: note.commentCount,
    favoriteCount: note.favoriteCount,
    liked: !!note.liked,
    favorited: !!note.favorited,
    visibility: note.visibility,
    createdAt: note.createdAt,
    disclaimer: note.disclaimer
  }
}

export function mockTopics() {
  return { list: TOPICS.filter((item) => item.id) }
}

export function mockFeed(params: Record<string, any> = {}) {
  const tab = params.tab || 'recommend'
  const topicId = params.topicId || ''
  let list = notes.filter((item) => item.visibility === 'public')
  if (tab === 'following') {
    list = list.filter((item) => userById(item.authorId).followed)
  }
  if (topicId) list = list.filter((item) => (item.topicIds || []).indexOf(topicId) >= 0)
  return {
    list: list.map(cardOf),
    page: 1,
    pageSize: 20,
    total: list.length
  }
}

export function mockHot() {
  return { list: HOT_KEYWORDS }
}

export function mockSuggest(keyword: string) {
  const key = (keyword || '').trim()
  const list = HOT_KEYWORDS.map((item) => item.keyword)
    .concat(['藤壶怎么观察', '退潮安全', '石老人 牡蛎'])
    .filter((item) => !key || item.indexOf(key) >= 0)
  return { list: list.slice(0, 6) }
}

export function mockSearch(params: Record<string, any> = {}) {
  const keyword = (params.keyword || '').trim()
  const type = params.type || 'all'
  const notesHit = mockFeed({}).list.filter((item: any) => {
    const text = `${item.title}${item.spotName}${(item.topics || []).map((t: any) => t.name).join('')}`
    return !keyword || text.indexOf(keyword) >= 0
  })
  const usersHit = USERS.filter((item) => !keyword || `${item.nickname}${item.title}`.indexOf(keyword) >= 0)
    .map((item) => ({
      id: item.id,
      nickname: item.nickname,
      avatarUrl: item.avatarUrl,
      title: item.title,
      noteCount: item.noteCount,
      followerCount: item.followerCount,
      followed: !!item.followed
    }))
  const topicsHit = TOPICS.filter((item) => item.id && (!keyword || item.name.indexOf(keyword) >= 0))
  return {
    notes: { list: type === 'user' || type === 'topic' ? [] : notesHit, page: 1, pageSize: 20, total: notesHit.length },
    users: { list: type === 'note' || type === 'topic' ? [] : usersHit },
    topics: { list: type === 'note' || type === 'user' ? [] : topicsHit }
  }
}

export function mockNote(id: string) {
  const note = notes.find((item) => item.id === id)
  if (!note) return null
  return detailOf(note)
}

export function mockComments(noteId: string) {
  const list = (comments[noteId] || []).map((item) => ({
    id: item.id,
    content: item.content,
    createdAt: item.createdAt,
    author: userById(item.authorId),
    replyTo: item.replyTo
  }))
  return { list, page: 1, pageSize: 20, total: list.length }
}

export function mockCreate(body: Record<string, any>) {
  const me = currentUser()
  const id = `note_${Date.now()}`
  const cover = (body.imageUrls && body.imageUrls[0]) || '/assets/badges/crab-cloud.png'
  const note = {
    id,
    title: body.title,
    content: body.content,
    coverUrl: cover,
    coverHeight: 280,
    imageUrls: body.imageUrls || [cover],
    topicIds: body.topicIds || [],
    spotId: body.spotId || '',
    spotName: body.spotName || '',
    speciesId: body.speciesId,
    speciesName: body.speciesName,
    authorId: me.id,
    likeCount: 0,
    commentCount: 0,
    favoriteCount: 0,
    liked: false,
    favorited: false,
    visibility: 'public',
    createdAt: nowISO(),
    disclaimer: '这是观察分享，不是物种鉴定。请对照图鉴，不要采集生物。'
  }
  if (!USERS.find((item) => item.id === me.id)) {
    USERS.unshift(Object.assign({
      noteCount: 0,
      likeCount: 0,
      favoriteCount: 0,
      followerCount: 0,
      followingCount: 0,
      followed: false
    }, me))
  }
  notes.unshift(note)
  return detailOf(note)
}

export function mockToggleLike(noteId: string) {
  const note = notes.find((item) => item.id === noteId)
  if (!note) return { liked: false, favorited: false, likeCount: 0, favoriteCount: 0 }
  note.liked = !note.liked
  note.likeCount += note.liked ? 1 : -1
  return {
    liked: note.liked,
    favorited: !!note.favorited,
    likeCount: note.likeCount,
    favoriteCount: note.favoriteCount
  }
}

export function mockToggleFavorite(noteId: string) {
  const note = notes.find((item) => item.id === noteId)
  if (!note) return { liked: false, favorited: false, likeCount: 0, favoriteCount: 0 }
  note.favorited = !note.favorited
  note.favoriteCount += note.favorited ? 1 : -1
  return {
    liked: !!note.liked,
    favorited: note.favorited,
    likeCount: note.likeCount,
    favoriteCount: note.favoriteCount
  }
}

export function mockAddComment(noteId: string, content: string) {
  const me = currentUser()
  const item = {
    id: `cmt_${Date.now()}`,
    content,
    createdAt: nowISO(),
    authorId: me.id,
    replyTo: null
  }
  comments[noteId] = comments[noteId] || []
  comments[noteId].unshift(item)
  const note = notes.find((n) => n.id === noteId)
  if (note) note.commentCount = (note.commentCount || 0) + 1
  return {
    id: item.id,
    content,
    createdAt: item.createdAt,
    author: me,
    replyTo: null
  }
}

export function mockFollow(userId: string, followed: boolean) {
  const user = userById(userId)
  user.followed = followed
  user.followerCount = Math.max(0, (user.followerCount || 0) + (followed ? 1 : -1))
  return { followed: user.followed, followerCount: user.followerCount }
}

export function mockUser(userId: string, tab = 'notes') {
  const me = currentUser()
  const id = userId === 'me' ? me.id : userId
  const user = Object.assign({}, userById(id), { me: id === me.id })
  const list = tab === 'favorites'
    ? notes.filter((item) => item.favorited).map(cardOf)
    : notes.filter((item) => item.authorId === id).map(cardOf)
  return {
    user,
    notes: { list, page: 1, pageSize: 20, total: list.length }
  }
}
