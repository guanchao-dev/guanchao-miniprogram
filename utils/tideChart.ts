export type TidePoint = {
  time: string
  heightM: number
  type?: string
}

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
  // 数据不足就返回空，由页面显示转圈/空态，不塞演示曲线
  return points.length >= 2 ? points : []
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

export function drawTideChart(page: any, points: TidePoint[], currentHeightM?: number, opts?: {
  canvasId?: string
  dark?: boolean
}): void {
  const canvasId = (opts && opts.canvasId) || '#tideCanvas'
  const dark = !!(opts && opts.dark)
  const theme = dark
    ? {
        bg: '#152238',
        grid: 'rgba(255,255,255,0.08)',
        area: 'rgba(46, 196, 182, 0.28)',
        line: '#2EC4B6',
        text: '#8AA4BE',
        now: '#F6D081',
        high: '#F4A51C',
        low: '#2EC4B6'
      }
    : {
        bg: '#F3FBFA',
        grid: '#D7E8E4',
        area: 'rgba(52, 184, 197, 0.22)',
        line: '#1888BF',
        text: '#6B7C8A',
        now: '#F4A51C',
        high: '#184D97',
        low: '#34B8C5'
      }
  const query = page && page.createSelectorQuery
    ? page.createSelectorQuery()
    : wx.createSelectorQuery()
  query.select(canvasId)
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

      ctx.fillStyle = theme.bg
      ctx.fillRect(0, 0, width, height)

      ctx.strokeStyle = theme.grid
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
      ctx.fillStyle = theme.area
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(mapped[0].x, mapped[0].y)
      addCurve(ctx, mapped.slice(1).length ? [mapped[0]].concat(mapped.slice(1)) : mapped)
      ctx.strokeStyle = theme.line
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
        ctx.strokeStyle = pt.p.type === 'high' ? theme.high : theme.low
        ctx.stroke()
      })

      if (currentHeightM != null && !Number.isNaN(Number(currentHeightM))) {
        const y = padT + (1 - (Number(currentHeightM) - minH) / span) * chartH
        ctx.setLineDash([5, 4])
        ctx.strokeStyle = theme.now
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(width - padR, y)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = theme.now
        ctx.font = '10px sans-serif'
        ctx.fillText(`现在 ${Number(currentHeightM).toFixed(1)}m`, padL, Math.max(12, y - 6))
      }

      ctx.setLineDash([3, 3])
      ctx.strokeStyle = dark ? 'rgba(246, 208, 129, 0.45)' : 'rgba(244, 165, 28, 0.55)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL + chartW / 2, padT)
      ctx.lineTo(padL + chartW / 2, padT + chartH)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = theme.text
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
