import { useState } from 'react'
import { Mail } from 'lucide-react'
import type { Car } from './CarSelector'

export function PriceAlertCard({ car, part, targetPrice }: { car: Car; part: string; targetPrice: number }) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || targetPrice <= 0) return
    setSubscribing(true)
    setError(null)
    try {
      const res = await fetch('/api/supabase/price-alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          year: car.year,
          make: car.make,
          model: car.model,
          trim: car.trim || '',
          part,
          target_price: targetPrice,
        }),
      })
      if (!res.ok) throw new Error('Failed to subscribe')
      setSubscribed(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <div className="icon-tile bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
          <Mail size={17} />
        </div>
        <div>
          <div className="font-semibold tracking-tight text-slate-950">Price drop alerts</div>
          <div className="text-xs text-slate-500">Get notified when this part gets cheaper</div>
        </div>
      </div>

      {subscribed ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-scale-up">
          ✓ Alert active! We'll email you if prices drop below ${targetPrice.toFixed(2)}.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Target alert threshold set to the best value price of <strong>${targetPrice.toFixed(2)}</strong>.
          </p>
          <input
            type="email"
            placeholder="your.email@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field py-2 text-xs"
          />
          <button
            type="submit"
            disabled={subscribing}
            className="btn btn-primary w-full py-2.5 text-xs font-bold"
          >
            {subscribing ? 'Creating alert…' : 'Notify Me'}
          </button>
          {error && <p className="text-[11px] text-rose-600">{error}</p>}
        </form>
      )}
    </div>
  )
}
