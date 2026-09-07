export type BBox = {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

export type Venue = {
  venueId: string
  name: string
  city?: string
  center: { latitude: number, longitude: number }
  bbox: BBox
  gridSizeM: number
  scale?: number
  needGuardian?: boolean
}

export const DEFAULT_VENUE: Venue = {
  venueId: 'spot_qd_shilaoren',
  name: '青岛 · 石老人',
  city: '青岛',
  center: { latitude: 36.0932, longitude: 120.4768 },
  bbox: {
    minLat: 36.088,
    minLng: 120.468,
    maxLat: 36.099,
    maxLng: 120.488
  },
  gridSizeM: 40,
  scale: 16,
  needGuardian: true
}

function metersPerDeg(bbox: BBox) {
  const midLat = (bbox.minLat + bbox.maxLat) / 2
  return {
    latM: 111320,
    lngM: 111320 * Math.cos((midLat * Math.PI) / 180)
  }
}

export function gridShape(bbox: BBox, cellM: number) {
  const { latM, lngM } = metersPerDeg(bbox)
  return {
    rows: Math.max(1, Math.ceil(((bbox.maxLat - bbox.minLat) * latM) / cellM)),
    cols: Math.max(1, Math.ceil(((bbox.maxLng - bbox.minLng) * lngM) / cellM)),
    latM,
    lngM
  }
}

export function pointToGridId(venueId: string, lat: number, lng: number, bbox: BBox, cellM: number): string {
  const { rows, cols, latM, lngM } = gridShape(bbox, cellM)
  const row = Math.floor(((lat - bbox.minLat) * latM) / cellM)
  const col = Math.floor(((lng - bbox.minLng) * lngM) / cellM)
  if (row < 0 || col < 0 || row >= rows || col >= cols) return ''
  return `${venueId}:${row}:${col}`
}

function cellRect(bbox: BBox, cellM: number, row: number, col: number, rowSpan = 1, colSpan = 1) {
  const { latM, lngM } = metersPerDeg(bbox)
  const south = bbox.minLat + (row * cellM) / latM
  const north = bbox.minLat + ((row + rowSpan) * cellM) / latM
  const west = bbox.minLng + (col * cellM) / lngM
  const east = bbox.minLng + ((col + colSpan) * cellM) / lngM
  return [
    { latitude: north, longitude: west },
    { latitude: north, longitude: east },
    { latitude: south, longitude: east },
    { latitude: south, longitude: west }
  ]
}

export function fogPolygons(venueId: string, bbox: BBox, cellM: number, visited: string[]) {
  const seen: Record<string, boolean> = {}
  visited.forEach((id) => { seen[id] = true })
  const { rows, cols } = gridShape(bbox, cellM)
  const polygons: any[] = []
  for (let row = 0; row < rows; row++) {
    let col = 0
    while (col < cols) {
      if (seen[`${venueId}:${row}:${col}`]) {
        col += 1
        continue
      }
      let span = 1
      while (col + span < cols && !seen[`${venueId}:${row}:${col + span}`]) span += 1
      polygons.push({
        points: cellRect(bbox, cellM, row, col, 1, span),
        fillColor: '#184D9799',
        strokeColor: '#184D9700',
        strokeWidth: 0,
        zIndex: 1
      })
      col += span
    }
  }
  return polygons
}

export function exploreRatio(venueId: string, bbox: BBox, cellM: number, visited: string[]) {
  const { rows, cols } = gridShape(bbox, cellM)
  const total = rows * cols
  if (!total) return 0
  const uniq: Record<string, boolean> = {}
  visited.forEach((id) => {
    if (id && id.indexOf(`${venueId}:`) === 0) uniq[id] = true
  })
  return Math.min(1, Object.keys(uniq).length / total)
}
