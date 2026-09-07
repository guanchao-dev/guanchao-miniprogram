export function splitWaterfall(list: any[]): { left: any[], right: any[] } {
  const left: any[] = []
  const right: any[] = []
  let leftH = 0
  let rightH = 0
  ;(list || []).forEach((item) => {
    const height = Number(item.coverHeight) || 280
    if (leftH <= rightH) {
      left.push(item)
      leftH += height + 90
    } else {
      right.push(item)
      rightH += height + 90
    }
  })
  return { left, right }
}
