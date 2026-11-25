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
  /** 当前时间在曲线上的位置（0~1）；仅当天传入，用于「现在」竖线 */
  nowRatio?: number
  /** 最佳赶海时段（当天的分钟数，0~1440）；用于在曲线背景铺色块 */
  bestRange?: { from: number; to: number }
  /** 画完导出成图片，交给页面用 image 展示（避免原生 canvas 盖住悬浮层） */
  exportImage?: boolean
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
      const rawMin = Math.min.apply(null, heights)
      const rawMax = Math.max.apply(null, heights)
      // 纵轴取整到米，保证有 0m / 1m / 2m… 这类可读刻度
      const scaleMin = Math.floor(rawMin)
      const scaleMax = Math.max(Math.ceil(rawMax), scaleMin + 1)
      const span = scaleMax - scaleMin

      const mapped = points.map((p, i) => ({
        x: padL + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW),
        y: padT + (1 - (p.heightM - scaleMin) / span) * chartH,
        p
      }))

      ctx.fillStyle = theme.bg
      ctx.fillRect(0, 0, width, height)

      // 横向刻度线 + 左侧潮高（m）标签
      const scaleStep = span <= 6 ? 1 : 2
      ctx.strokeStyle = theme.grid
      ctx.lineWidth = 1
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'right'
      for (let v = scaleMin; v <= scaleMax + 0.001; v += scaleStep) {
        const y = padT + (1 - (v - scaleMin) / span) * chartH
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(width - padR, y)
        ctx.stroke()
        ctx.fillStyle = theme.text
        ctx.fillText(`${Number(v.toFixed(1))}m`, padL - 6, y + 3)
      }

      // 最佳赶海时段：在曲线背景下铺一层暖色块，并把这段曲线染黄
      const bestRange = opts && opts.bestRange
      const parseMin = (time: string) => {
        const parts = String(time).split(':')
        return Number(parts[0]) * 60 + Number(parts[1] || 0)
      }
      // 接口的 24 小时数据以 00:00 开始、次日 00:00 结束，终点会被当成 0 分钟，
      // 这里按时间先后展开成 0 → 1440 的连续轴，避免跨零点判断失效
      const times: number[] = []
      points.forEach((item, i) => {
        let value = parseMin(item.time)
        if (i > 0) {
          while (value < times[i - 1]) value += 1440
        }
        times.push(value)
      })
      const firstMin = times[0]
      const lastMin = times[times.length - 1]
      const totalMin = lastMin - firstMin
      const hasTimeAxis = totalMin > 0
      const xOf = (min: number) => padL + (
        (Math.min(Math.max(min, firstMin), lastMin) - firstMin) / totalMin
      ) * chartW
      let bestFrom = 0
      let bestTo = 0
      if (bestRange && hasTimeAxis) {
        bestFrom = bestRange.from
        while (bestFrom < firstMin) bestFrom += 1440
        while (bestFrom - 1440 >= firstMin) bestFrom -= 1440
        bestTo = bestRange.to
        while (bestTo <= bestFrom) bestTo += 1440
        bestTo = Math.min(bestTo, lastMin + 1440)
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

      // 赶海时段：把曲线落在最佳窗口里的那一段染成黄色
      if (bestRange && hasTimeAxis && bestTo > bestFrom) {
        const strokeSeg = (from: number, to: number) => {
          const x1 = xOf(from)
          const x2 = xOf(to)
          if (x2 - x1 < 0.5) return
          ctx.save()
          ctx.beginPath()
          ctx.rect(x1, 0, Math.max(1, x2 - x1), height)
          ctx.clip()
          ctx.beginPath()
          ctx.moveTo(mapped[0].x, mapped[0].y)
          addCurve(ctx, mapped)
          ctx.strokeStyle = '#FFC53D'
          ctx.lineWidth = 4
          ctx.stroke()
          ctx.restore()
        }
        strokeSeg(bestFrom, Math.min(bestTo, lastMin))
        if (bestTo > lastMin) strokeSeg(firstMin, bestTo - 1440)
      }

      // 峰谷处直接标潮高数值（不画圆圈，只留数字）
      const valueIdx = (() => {
        const tagged: number[] = []
        mapped.forEach((pt, i) => {
          if (pt.p.type === 'high' || pt.p.type === 'low') tagged.push(i)
        })
        return tagged.length ? tagged : localExtremes(mapped)
      })()
      valueIdx.forEach((i) => {
        const pt = mapped[i]
        if (!pt) return
        const isHigh = pt.p.type === 'high' || pt.p.heightM >= rawMax - 0.001
        ctx.fillStyle = isHigh ? theme.high : theme.low
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${pt.p.heightM.toFixed(1)}m`, pt.x, Math.max(padT + 9, pt.y - 8))
      })

      const ratio = opts && typeof opts.nowRatio === 'number' ? Math.max(0, Math.min(1, opts.nowRatio)) : null
      if (ratio !== null) {
        const nowX = padL + ratio * chartW
        ctx.setLineDash([5, 4])
        ctx.strokeStyle = '#F4B71C'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(nowX, padT)
        ctx.lineTo(nowX, padT + chartH)
        ctx.stroke()
        ctx.setLineDash([])

        // 「现在 1.8m」：贴住竖线顶部，左右收边避免被裁掉
        ctx.fillStyle = theme.now
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        const nowText = currentHeightM != null && !Number.isNaN(Number(currentHeightM))
          ? `现在 ${Number(currentHeightM).toFixed(1)}m`
          : '现在'
        const textWidth = ctx.measureText(nowText).width
        const textX = Math.max(padL + textWidth / 2, Math.min(width - padR - textWidth / 2, nowX))
        ctx.fillText(nowText, textX, Math.max(11, padT - 5))
      }

      ctx.fillStyle = theme.text
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      const labelStep = Math.max(1, Math.ceil(mapped.length / 6))
      mapped.forEach((pt, i) => {
        if (i % labelStep === 0 || i === mapped.length - 1) {
          // 终点是次日 00:00，轴尾标成 24:00，避免首尾两个 00:00
          const label = i === mapped.length - 1 && pt.p.time === '00:00' ? '24:00' : pt.p.time
          ctx.fillText(label, pt.x, height - 8)
        }
      })

      if (opts && opts.exportImage && page && typeof page.setData === 'function') {
        wx.canvasToTempFilePath({
          canvas,
          success: (res: any) => page.setData({
            chartImage: res.tempFilePath,
            chartCanvas: false
          }),
          // 导出失败就保留画布，宁可层级有问题也不能让曲线消失
          fail: () => page.setData({ chartCanvas: true })
        })
      }
    })
}
