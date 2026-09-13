const CLIENT_KEY = 'clientId'

export function getClientId(): string {
  let id = wx.getStorageSync(CLIENT_KEY)
  if (id) return id
  id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  wx.setStorageSync(CLIENT_KEY, id)
  return id
}
