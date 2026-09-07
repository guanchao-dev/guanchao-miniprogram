export type TidePoint = {
  time: string
  heightM: number
  type?: string
}

export const DEMO_TIDE_POINTS: TidePoint[] = [
  { time: '06:20', heightM: 0.32, type: 'low' },
  { time: '09:10', heightM: 1.05, type: 'rising' },
  { time: '12:10', heightM: 1.86, type: 'high' },
  { time: '16:20', heightM: 0.58, type: 'low' },
  { time: '18:40', heightM: 2.04, type: 'high' },
  { time: '22:30', heightM: 0.74, type: 'falling' }
]

function toPoints(raw: any[]): TidePoint[] {
  return (raw || [])
    .map((item) => ({
      time: String(item.time || item.fxTime || ''),
      heightM: Number(item.heightM != null ? item.heightM : item.height),
      type: item.type
    }))
    .filter((item) => item.time && !Number.isNaN(item.heightM))
}

export function normalizeTidePoints(raw: any[]): TidePoint[] {
  const points = toPoints(raw)
  return points.length >= 2 ? points : DEMO_TIDE_POINTS
}

function addCurve(ctx: any, pts: Array<{ x: number, y: number }>): void {
  if (!pts.length) return
  ctx.lineTo(pts[0].x, pts[0].y)
  if (pts.length === 1) return
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y)
    return
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2
    const yc = (pts[i].y + pts[i + 1].y) / 2
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc)
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
}

function localExtremes(mapped: Array<{ x: number, y: number, p: TidePoint }>): number[] {
  const idx: number[] = []
  for (let i = 1; i < mapped.length - 1; i++) {
    const prev = mapped[i - 1].p.heightM
    const cur = mapped[i].p.heightM
    const next = mapped[i + 1].p.heightM
    if ((cur > prev && cur >= next) || (cur < prev && cur <= next)) {
      idx.push(i)
    }
  }
  return idx
}

export function drawTideChart(page: any, points: TidePoint[], currentHeightM?: number): void {
  const query = page && page.createSelectorQuery
    ? page.createSelectorQuery()
    : wx.createSelectorQuery()
  query.select('#tideCanvas')
    .fields({ node: true, size: true })
    .exec((res: any[]) => {
      const target = res && res[0]
      if (!target || !target.node) return
      const canvas = target.node
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = wx.getSystemInfoSync().pixelRatio || 1
      const width = target.width
      const height = target.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      const padL = 36
      const padR = 16
      const padT = 18
      const padB = 28
      const chartW = width - padL - padR
      const chartH = height - padT - padB
      const heights = points.map((p) => p.heightM)
      const minH = Math.min.apply(null, heights)
      const maxH = Math.max.apply(null, heights)
      const span = maxH - minH || 1

      const mapped = points.map((p, i) => ({
        x: padL + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW),
        y: padT + (1 - (p.heightM - minH) / span) * chartH,
        p
      }))

      ctx.fillStyle = '#F3FBFA'
      ctx.fillRect(0, 0, width, height)

      ctx.strokeStyle = '#D7E8E4'
      ctx.lineWidth = 1
      for (let i = 0; i <= 3; i++) {
        const y = padT + (chartH / 3) * i
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(width - padR, y)
        ctx.stroke()
      }

      const area = mapped.slice()
      ctx.beginPath()
      ctx.moveTo(area[0].x, padT + chartH)
      addCurve(ctx, area)
      ctx.lineTo(area[area.length - 1].x, padT + chartH)
      ctx.closePath()
      ctx.fillStyle = 'rgba(52, 184, 197, 0.22)'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(mapped[0].x, mapped[0].y)
      addCurve(ctx, mapped.slice(1).length ? [mapped[0]].concat(mapped.slice(1)) : mapped)
      ctx.strokeStyle = '#1888BF'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()

      const dotIndexes = mapped.length <= 6
        ? mapped.map((_, i) => i)
        : localExtremes(mapped)
      dotIndexes.forEach((i) => {
        const pt = mapped[i]
        ctx.beginPath()
        ctx.fillStyle = '#FFFFFF'
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = pt.p.type === 'high' ? '#184D97' : '#34B8C5'
        ctx.stroke()
      })

      if (currentHeightM != null && !Number.isNaN(Number(currentHeightM))) {
        const y = padT + (1 - (Number(currentHeightM) - minH) / span) * chartH
        ctx.setLineDash([5, 4])
        ctx.strokeStyle = '#F4A51C'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(width - padR, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = '#C48A2A'
        ctx.font = '10px sans-serif'
        ctx.fillText(`现在 ${Number(currentHeightM).toFixed(1)}m`, padL, Math.max(12, y - 6))
      }

      // 垂直「现在」参考线：后端返回 ±12h 窗口，当前时刻位于图表水平中点
      ctx.setLineDash([3, 3])
      ctx.strokeStyle = 'rgba(244, 165, 28, 0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL + chartW / 2, padT)
      ctx.lineTo(padL + chartW / 2, padT + chartH)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = '#6B7C8A'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      const labelStep = Math.max(1, Math.ceil(mapped.length / 6))
      mapped.forEach((pt, i) => {
        if (i % labelStep === 0 || i === mapped.length - 1) {
          ctx.fillText(pt.p.time, pt.x, height - 8)
        }
      })
    })
}
