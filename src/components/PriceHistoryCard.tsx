import { useEffect, useState } from 'react'
import { TrendingDown } from 'lucide-react'
import { fetchPriceHistory, type PriceObservation } from '../api/client'
import type { Car } from './CarSelector'
import { Sparkline } from './Sparkline'

// The results screen keys this optional card by search identity so navigation
// and ZIP/retry changes unmount the old chart and cancel its request.
export function PriceHistoryCard({ car, part }: { car: Car; part: string }) {
  const [history, setHistory] = useState<PriceObservation[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    fetchPriceHistory(car.year, car.make, car.model, part, controller.signal)
      .then(({ observations }) => {
        // The chart requires five observations. An empty/short history is
        // normal and should not trigger another render of the result cards.
        if (!cancelled && observations.length >= 5) setHistory(observations)
      })
      .catch(() => {
        // Optional observed history must never turn a successful live search
        // into an error or imply that missing observations are a zero price.
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [car.year, car.make, car.model, part])

  if (!history) return null
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <div className="icon-tile bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400"><TrendingDown size={17} /></div>
        <div>
          <div className="font-semibold tracking-tight text-slate-950">Price radar — observed lows</div>
          <div className="text-xs text-slate-500">Lowest daily item + known shipping, before tax, we've seen for this search</div>
        </div>
      </div>
      <div className="mt-4 text-brand-600 dark:text-brand-400">
        <Sparkline points={history} />
      </div>
      <div className="font-data mt-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
        <span>Low ${Math.min(...history.map((point) => point.price)).toFixed(2)}</span>
        <span>High ${Math.max(...history.map((point) => point.price)).toFixed(2)}</span>
        <span>Since {new Date(`${history[0].date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  )
}
