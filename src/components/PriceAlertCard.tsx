import { useState } from 'react'
import { Mail } from 'lucide-react'
import type { Car } from './CarSelector'
import { friendlyApiError } from '../lib/apiErrors.js'
import { trackEvent } from '../lib/analytics'

export function PriceAlertCard({ car, part, targetPrice }: { car: Car; part: string; targetPrice: number }) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedEmail = email.trim()
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (targetPrice <= 0) return
    setSubscribing(true)
    setError(null)
    try {
      let res: Response
      try {
        res = await fetch('/api/supabase/price-alerts/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: normalizedEmail,
            year: car.year,
            make: car.make,
            model: car.model,
            trim: car.trim || '',
            part,
            target_price: targetPrice,
          }),
        })
      } catch {
        throw new Error(friendlyApiError('/api/supabase/price-alerts/subscribe', 0))
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errorData.error || friendlyApiError('/api/supabase/price-alerts/subscribe', res.status))
      }
      trackEvent('Price Alert Created', {
        year: car.year,
        make: car.make,
        model: car.model,
        trim: car.trim || undefined,
        part,
        targetPrice,
      })
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
        <div role="status" className="mt-4 rounded-2xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 animate-scale-up">
          ✓ Alert active! We'll email you if prices drop below ${targetPrice.toFixed(2)}.
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Target alert threshold set to the current lowest available price of <strong>${targetPrice.toFixed(2)}</strong>.
          </p>
          <label htmlFor="price-alert-email" className="field-label">Email address</label>
          <input
            id="price-alert-email"
            type="email"
            placeholder="your.email@example.com"
            maxLength={254}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'price-alert-error' : undefined}
            className="field py-2 text-xs"
          />
          <button
            type="submit"
            disabled={subscribing}
            className="btn btn-primary w-full py-2.5 text-xs font-bold"
          >
            {subscribing ? 'Creating alert…' : 'Notify Me'}
          </button>
          {error && <p id="price-alert-error" role="alert" className="text-[11px] text-rose-600">{error}</p>}
        </form>
      )}
    </div>
  )
}
