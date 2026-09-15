/**
 * 后端联调地址。
 * 开发者工具模拟器可用 127.0.0.1。
 * 真机预览请改成电脑局域网 IP，例如 http://192.168.1.12:8000/api/v1
 */
export const BASE_URL = 'https://www.blueakaiwu.cn/api/v1'

export const DEFAULT_SPOT_ID = 'spot_qd_shilaoren'

/**
 * 腾讯位置服务 Key 属于本机敏感配置，统一放在 env.local.ts 中（已 gitignore，不入库）。
 * 新成员首次拉取代码后，复制 config/env.example.ts 为 config/env.local.ts 并填入真实 Key。
 */
export { TENCENT_MAP_KEY } from './env.local'
