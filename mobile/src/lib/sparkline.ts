// Normalize a price series to bar heights in 0..1. A flat series renders at
// mid-height rather than zero so the chart still reads as data.
export function sparklineHeights(prices: number[]): number[] {
  if (prices.length === 0) return []
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (max === min) return prices.map(() => 0.5)
  return prices.map((p) => (p - min) / (max - min))
}
