import { BASE_URL } from '../config/env'
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './auth'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

type HttpOptions = {
  url: string
  method?: Method
  data?: Record<string, any>
  header?: Record<string, string>
  auth?: boolean
  timeout?: number
  idempotency?: boolean
}

export class ApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function buildQuery(data?: Record<string, any>): string {
  if (!data) return ''
  const parts: string[] = []
  Object.keys(data).forEach((key) => {
    const value = data[key]
    if (value === undefined || value === null || value === '') return
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  })
  return parts.length ? `?${parts.join('&')}` : ''
}

function parseBody(raw: any): any {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (e) {
      return raw
    }
  }
  return raw
}

function pickData(body: any): any {
  if (body && typeof body === 'object' && 'data' in body) return body.data
  return body
}

let refreshing = false
let waiters: Array<(token: string) => void> = []

function notifyWaiters(token: string): void {
  waiters.forEach((fn) => fn(token))
  waiters = []
}

function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.reject(new ApiError(40101, '请先登录'))
  if (refreshing) {
    return new Promise((resolve) => waiters.push(resolve))
  }
  refreshing = true
  return rawRequest({
    url: '/auth/refresh',
    method: 'POST',
    data: { refreshToken },
    auth: false
  }).then((data) => {
    saveSession(data || {})
    const token = (data && data.accessToken) || getAccessToken()
    notifyWaiters(token)
    return token
  }).catch((err) => {
    clearSession()
    notifyWaiters('')
    throw err
  }).finally(() => {
    refreshing = false
  })
}

function rawRequest(options: HttpOptions): Promise<any> {
  const method = options.method || 'GET'
  const query = method === 'GET' ? buildQuery(options.data) : ''
  const header: Record<string, string> = Object.assign({
    'Content-Type': 'application/json',
    'X-Request-Id': uuid()
  }, options.header || {})

  if (options.auth !== false) {
    const token = getAccessToken()
    if (token) header.Authorization = `Bearer ${token}`
  }
  if (options.idempotency) {
    header['Idempotency-Key'] = `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${options.url}${query}`,
      method,
      data: method === 'GET' ? undefined : (options.data || {}),
      header,
      timeout: options.timeout || 20000,
      success(res: any) {
        const body = parseBody(res.data)
        const code = body && typeof body === 'object' ? Number(body.code) : 0
        if (res.statusCode === 401 || code === 40101) {
          reject(new ApiError(40101, (body && body.message) || '未登录或 token 失效'))
          return
        }
        if (res.statusCode >= 400 || (code && code !== 0)) {
          reject(new ApiError(code || res.statusCode, (body && body.message) || '请求失败'))
          return
        }
        resolve(pickData(body))
      },
      fail(err: any) {
        reject(new ApiError(50001, (err && err.errMsg) || '网络错误，请检查后端地址'))
      }
    })
  })
}

function request(options: HttpOptions): Promise<any> {
  return rawRequest(options).catch((err: ApiError) => {
    if (err.code !== 40101 || options.auth === false || options.url === '/auth/refresh') {
      throw err
    }
    return refreshAccessToken().then((token) => {
      if (!token) throw err
      return rawRequest(options)
    })
  })
}

const http = {
  get(url: string, data?: Record<string, any>, extra?: Partial<HttpOptions>) {
    return request(Object.assign({ url, method: 'GET' as Method, data, auth: true }, extra))
  },
  post(url: string, data?: Record<string, any>, extra?: Partial<HttpOptions>) {
    return request(Object.assign({ url, method: 'POST' as Method, data, auth: true }, extra))
  },
  delete(url: string, data?: Record<string, any>, extra?: Partial<HttpOptions>) {
    return request(Object.assign({ url, method: 'DELETE' as Method, data, auth: true }, extra))
  },
  upload(url: string, filePath: string, formData?: Record<string, any>): Promise<any> {
    const header: Record<string, string> = {
      'X-Request-Id': uuid()
    }
    const token = getAccessToken()
    if (token) header.Authorization = `Bearer ${token}`
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${BASE_URL}${url}`,
        filePath,
        name: 'file',
        formData: formData || {},
        header,
        timeout: 30000,
        success(res: any) {
          const body = parseBody(res.data)
          const code = body && typeof body === 'object' ? Number(body.code) : 0
          if (res.statusCode >= 400 || (code && code !== 0)) {
            reject(new ApiError(code || res.statusCode, (body && body.message) || '上传失败'))
            return
          }
          resolve(pickData(body))
        },
        fail(err: any) {
          reject(new ApiError(50001, (err && err.errMsg) || '上传失败'))
        }
      })
    })
  }
}

export default http
