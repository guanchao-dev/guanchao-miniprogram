const ACCESS_KEY = 'accessToken'
const REFRESH_KEY = 'refreshToken'
const USER_KEY = 'authUser'

export type AuthUser = {
  id?: string
  nickname?: string
  avatarUrl?: string
  avatarKey?: string
  level?: number
  title?: string
  needGuardianConsent?: boolean
  phone?: string
}

export function getAccessToken(): string {
  return wx.getStorageSync(ACCESS_KEY) || ''
}

export function getRefreshToken(): string {
  return wx.getStorageSync(REFRESH_KEY) || ''
}

export function getUser(): AuthUser | null {
  return wx.getStorageSync(USER_KEY) || null
}

export function isLoggedIn(): boolean {
  return !!getAccessToken()
}

export function saveSession(payload: {
  accessToken?: string
  refreshToken?: string
  user?: AuthUser
}): void {
  if (payload.accessToken) wx.setStorageSync(ACCESS_KEY, payload.accessToken)
  if (payload.refreshToken) wx.setStorageSync(REFRESH_KEY, payload.refreshToken)
  if (payload.user) wx.setStorageSync(USER_KEY, payload.user)
}

export function clearSession(): void {
  wx.removeStorageSync(ACCESS_KEY)
  wx.removeStorageSync(REFRESH_KEY)
  wx.removeStorageSync(USER_KEY)
}

export function requireLogin(): boolean {
  if (isLoggedIn()) return true
  wx.navigateTo({ url: '/pages/login/login' })
  return false
}
