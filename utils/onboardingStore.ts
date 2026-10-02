/**
 * 新手教程状态存储。
 * - 完成标记：首次启动 / 设置页重放由它控制
 * - 进行中的步骤 index：跨 tab 页续接（首页→成就→我的→首页）
 */

const STORAGE_KEY = 'onboarding_completed'
const INDEX_KEY = 'onboarding_index'

export function shouldShowOnboarding(): boolean {
  try {
    return !wx.getStorageSync(STORAGE_KEY)
  } catch (e) {
    return true
  }
}

export function markOnboardingCompleted(): void {
  try {
    wx.setStorageSync(STORAGE_KEY, true)
  } catch (e) {
    /* ignore */
  }
}

export function resetOnboarding(): void {
  try {
    wx.removeStorageSync(STORAGE_KEY)
    wx.removeStorageSync(INDEX_KEY)
  } catch (e) {
    /* ignore */
  }
}

/** 教程进行中：index 有效且未完成 */
export function isOnboarding(): boolean {
  try {
    if (wx.getStorageSync(STORAGE_KEY)) return false
    const idx = wx.getStorageSync(INDEX_KEY)
    return typeof idx === 'number' && !isNaN(idx)
  } catch (e) {
    return false
  }
}

export function getOnboardingIndex(): number {
  try {
    const idx = wx.getStorageSync(INDEX_KEY)
    return typeof idx === 'number' ? idx : 0
  } catch (e) {
    return 0
  }
}

export function setOnboardingIndex(index: number): void {
  try {
    wx.setStorageSync(INDEX_KEY, index)
  } catch (e) {
    /* ignore */
  }
}

export function clearOnboardingIndex(): void {
  try {
    wx.removeStorageSync(INDEX_KEY)
  } catch (e) {
    /* ignore */
  }
}
