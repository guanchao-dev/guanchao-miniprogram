export type LightRegion = {
  id: string
  name: string
  hint: string
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
  left: number
  top: number
  width: number
  height: number
}

export type LightMap = {
  id: string
  name: string
  mapUrl: string
  regions: LightRegion[]
}

const MAP_KEY = 'lightMapCurrentId'
const LIT_PREFIX = 'lightMapLit:'

const MAP_IMAGE = 'https://www.blueakaiwu.cn/api/v1/static/assets/maps/coast-map.jpg'

export const LIGHT_MAPS: LightMap[] = [
  {
    id: 'qingdao',
    name: '青岛海岸',
    mapUrl: MAP_IMAGE,
    regions: [
      {
        id: 'isles',
        name: '离岛海域',
        hint: '竹岔岛一带',
        minLat: 35.96,
        minLng: 120.30,
        maxLat: 36.02,
        maxLng: 120.38,
        left: 0,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'jiaozhou',
        name: '胶州湾',
        hint: '团岛到红岛沿岸',
        minLat: 36.04,
        minLng: 120.28,
        maxLat: 36.16,
        maxLng: 120.40,
        left: 33,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'qd_east',
        name: '青岛东部海岸',
        hint: '石老人到小麦岛一带',
        minLat: 36.05,
        minLng: 120.42,
        maxLat: 36.12,
        maxLng: 120.52,
        left: 66,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'west_coast',
        name: '西海岸',
        hint: '黄岛金沙滩一带',
        minLat: 35.93,
        minLng: 120.16,
        maxLat: 36.02,
        maxLng: 120.30,
        left: 0,
        top: 48,
        width: 34,
        height: 52
      },
      {
        id: 'jimo',
        name: '即墨滨海',
        hint: '鳌山卫到田横岛',
        minLat: 36.32,
        minLng: 120.62,
        maxLat: 36.48,
        maxLng: 120.80,
        left: 33,
        top: 48,
        width: 34,
        height: 52
      },
      {
        id: 'laoshan',
        name: '崂山滨海',
        hint: '崂山湾与仰口',
        minLat: 36.12,
        minLng: 120.54,
        maxLat: 36.28,
        maxLng: 120.72,
        left: 66,
        top: 48,
        width: 34,
        height: 52
      }
    ]
  },
  {
    id: 'weihai',
    name: '威海海岸',
    mapUrl: MAP_IMAGE,
    regions: [
      {
        id: 'liugong',
        name: '刘公岛',
        hint: '威海湾中的海岛',
        minLat: 37.49,
        minLng: 122.12,
        maxLat: 37.52,
        maxLng: 122.20,
        left: 0,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'weihai_bay',
        name: '威海湾',
        hint: '国际海水浴场一带',
        minLat: 37.48,
        minLng: 122.04,
        maxLat: 37.54,
        maxLng: 122.14,
        left: 33,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'chengshantou',
        name: '成山头',
        hint: '天尽头东端',
        minLat: 37.36,
        minLng: 122.52,
        maxLat: 37.42,
        maxLng: 122.72,
        left: 66,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'huancui',
        name: '环翠沿岸',
        hint: '市区海边栈道',
        minLat: 37.50,
        minLng: 121.98,
        maxLat: 37.56,
        maxLng: 122.08,
        left: 0,
        top: 48,
        width: 34,
        height: 52
      },
      {
        id: 'rongcheng',
        name: '荣成滨海',
        hint: '天鹅湖到东褚岛',
        minLat: 37.32,
        minLng: 122.40,
        maxLat: 37.40,
        maxLng: 122.55,
        left: 33,
        top: 48,
        width: 34,
        height: 52
      },
      {
        id: 'shidao',
        name: '石岛',
        hint: '南部渔港海岸',
        minLat: 36.86,
        minLng: 122.40,
        maxLat: 36.94,
        maxLng: 122.48,
        left: 66,
        top: 48,
        width: 34,
        height: 52
      }
    ]
  },
  {
    id: 'rizhao',
    name: '日照海岸',
    mapUrl: MAP_IMAGE,
    regions: [
      {
        id: 'wanpingkou',
        name: '万平口',
        hint: '市区黄金海岸',
        minLat: 35.40,
        minLng: 119.54,
        maxLat: 35.46,
        maxLng: 119.62,
        left: 0,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'lighthouse',
        name: '灯塔风景区',
        hint: '日照灯塔附近',
        minLat: 35.38,
        minLng: 119.52,
        maxLat: 35.43,
        maxLng: 119.58,
        left: 33,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'taigong',
        name: '太公岛',
        hint: '近岸小岛一带',
        minLat: 35.36,
        minLng: 119.56,
        maxLat: 35.40,
        maxLng: 119.62,
        left: 66,
        top: 0,
        width: 34,
        height: 52
      },
      {
        id: 'jiangfeng',
        name: '姜太公故里岸',
        hint: '北部沿海',
        minLat: 35.48,
        minLng: 119.50,
        maxLat: 35.56,
        maxLng: 119.62,
        left: 0,
        top: 48,
        width: 34,
        height: 52
      },
      {
        id: 'donggang',
        name: '东港海岸',
        hint: '港口以南沙滩',
        minLat: 35.34,
        minLng: 119.48,
        maxLat: 35.40,
        maxLng: 119.56,
        left: 33,
        top: 48,
        width: 34,
        height: 52
      },
      {
        id: 'lanshan',
        name: '岚山滨海',
        hint: '南部岚山沿岸',
        minLat: 35.08,
        minLng: 119.30,
        maxLat: 35.18,
        maxLng: 119.42,
        left: 66,
        top: 48,
        width: 34,
        height: 52
      }
    ]
  }
]

function inBBox(lat: number, lng: number, region: LightRegion): boolean {
  return lat >= Number(region.minLat) && lat <= Number(region.maxLat)
    && lng >= Number(region.minLng) && lng <= Number(region.maxLng)
}

export function matchRegions(lat: number, lng: number, regions: LightRegion[]): LightRegion[] {
  if (!lat || !lng) return []
  return regions.filter((region) => inBBox(lat, lng, region))
}

export function getMapById(id?: string): LightMap {
  return LIGHT_MAPS.find((item) => item.id === id) || LIGHT_MAPS[0]
}

export function getCurrentMapId(): string {
  return wx.getStorageSync(MAP_KEY) || LIGHT_MAPS[0].id
}

export function saveCurrentMapId(id: string): void {
  wx.setStorageSync(MAP_KEY, id)
}

export function getLitIds(mapId: string): string[] {
  const saved = wx.getStorageSync(LIT_PREFIX + mapId)
  return Array.isArray(saved) ? saved : []
}

export function saveLitIds(mapId: string, ids: string[]): void {
  wx.setStorageSync(LIT_PREFIX + mapId, ids)
}

export function fetchLocation(): Promise<{ lat: number, lng: number }> {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success(res) {
        const lat = Number(res.latitude)
        const lng = Number(res.longitude)
        if (!lat || !lng) {
          reject(new Error('no location'))
          return
        }
        resolve({ lat, lng })
      },
      fail: reject
    })
  })
}
