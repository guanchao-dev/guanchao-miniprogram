import { BASE_URL, DEFAULT_SPOT_ID } from '../config/env'
import http from './http'
import { pick } from './format'

export function chooseImages(count = 9): Promise<string[]> {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      camera: 'back',
      success(res: any) {
        const list = (res.tempFiles || []).map((item: any) => item.tempFilePath).filter(Boolean)
        if (!list.length) {
          reject(new Error('未选择图片'))
          return
        }
        resolve(list)
      },
      fail(err: any) {
        if (err && String(err.errMsg).indexOf('cancel') >= 0) {
          reject(new Error('cancel'))
          return
        }
        reject(new Error((err && err.errMsg) || '选择图片失败'))
      }
    })
  })
}

export function chooseImage(): Promise<string> {
  return chooseImages(1).then((list) => {
    if (!list.length) throw new Error('未选择图片')
    return list[0]
  })
}

export async function uploadImage(scene: 'speciesGuess' | 'observation' | 'card' | 'community', filePath: string): Promise<string> {
  const data = await http.upload('/uploads', filePath, { scene })
  const uploadId = pick(data, 'uploadId', 'upload_id', 'id')
  if (!uploadId) throw new Error('上传成功但未返回 uploadId')
  const status = pick(data, 'status')
  if (status === 'processing') {
    try {
      await http.post(`/uploads/${uploadId}/complete`)
    } catch (e) {
      // 本地直传可能已是 approved，complete 失败不阻断
    }
  }
  return String(uploadId)
}

export function uploadContentUrl(uploadId: string): string {
  return `${BASE_URL}/uploads/${uploadId}/content`
}

export function mediaUrl(path: string): string {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return `${BASE_URL}${path}`
}

export function downloadImage(url: string): Promise<string> {
  return new Promise((resolve) => {
    if (!url) {
      resolve('')
      return
    }
    wx.downloadFile({
      url,
      success: (res: any) => {
        resolve(res.statusCode === 200 && res.tempFilePath ? res.tempFilePath : '')
      },
      fail: () => resolve('')
    })
  })
}

// 会话内图片缓存：同一 URL 只下载一次，供首页预加载与图鉴页复用
const imageCache: Record<string, string> = {}

export function preloadImage(url: string): Promise<string> {
  if (!url) return Promise.resolve('')
  const hit = imageCache[url]
  if (hit) return Promise.resolve(hit)
  return downloadImage(url).then((src) => {
    if (src) imageCache[url] = src
    return src
  })
}

export { DEFAULT_SPOT_ID }
