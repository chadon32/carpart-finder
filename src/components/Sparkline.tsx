// Pure-SVG sparkline for real observed prices — no chart library. Strokes use
// currentColor so the parent sets the color in both themes.
export function Sparkline({ points }: { points: { date: string; price: number }[] }) {
  if (points.length < 2) return null
  const w = 240
  const h = 56
  const pad = 4
  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1
  const x = (i: number) => pad + (i * (w - pad * 2)) / (points.length - 1)
  const y = (v: number) => h - pad - ((v - min) * (h - pad * 2)) / span
  const path = points.map((p, i) => `${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label={`Price history: low $${min.toFixed(2)}, high $${max.toFixed(2)}, latest $${last.price.toFixed(2)}`}
    >
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(points.length - 1)} cy={y(last.price)} r="2.5" fill="currentColor" />
    </svg>
  )
}
