import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  Wrench,
  Star,
  Award,
  Tag,
  Sparkles,
  MapPin,
  AlertTriangle,
  ExternalLink,
  Check,
  Plus,
  RotateCw,
  Truck,
  Store,
} from 'lucide-react'
import type { Car } from './CarSelector'
import { searchParts, type Listing } from '../api/client'
import { usePersistedState } from '../hooks/usePersistedState'
import { VehicleThumbnail } from './VehicleThumbnail'
import { retailerLinks } from '../data/retailerLinks'

type SortKey = 'value' | 'price' | 'rating'
type ConditionFilter = 'all' | 'new' | 'used'

function valueScore(l: Listing) {
  const pct = l.sellerFeedbackPercentage ? Number(l.sellerFeedbackPercentage) : 92
  const trust = Math.min(100, Math.max(80, pct))
  const penalty = (100 - trust) / 100
  let effective = l.price * (1 + penalty)
  if (l.topRatedSeller) effective *= 0.95
  return effective
}

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

// "Arrives Jul 6–9" (collapses the month when the range is within one month;
// single date otherwise). Returns null if no estimate available.
function deliveryLabel(l: Listing) {
  if (!l.deliveryMin && !l.deliveryMax) return null
  const min = l.deliveryMin ? new Date(l.deliveryMin) : null
  const max = l.deliveryMax ? new Date(l.deliveryMax) : null
  if (min && max && min.toDateString() !== max.toDateString()) {
    if (min.getMonth() === max.getMonth()) {
      return `Arrives ${dateFmt.format(min)}–${max.getDate()}`
    }
    return `Arrives ${dateFmt.format(min)}–${dateFmt.format(max)}`
  }
  const d = max || min
  return d ? `Arrives ${dateFmt.format(d)}` : null
}

function shippingLabel(l: Listing) {
  if (l.shippingCost == null) return null
  return l.shippingCost === 0 ? 'Free shipping' : `+$${l.shippingCost.toFixed(2)} shipping`
}

function isNew(l: Listing) {
  return l.condition?.toLowerCase().startsWith('new')
}
function isUsed(l: Listing) {
  const c = l.condition?.toLowerCase() ?? ''
  return c.includes('used') || c.includes('refurb')
}

function SkeletonCard() {
  return (
    <li className="card animate-pulse p-4">
      <div className="flex gap-4">
        <div className="h-24 w-24 shrink-0 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2.5 py-1">
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-100" />
          <div className="h-3 w-1/3 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      </div>
    </li>
  )
}

export function ResultsList({
  car,
  part,
  onBackToPart,
  onBackToCar,
  onAddToCart,
  isInCart,
}: {
  car: Car
  part: string
  onBackToPart: () => void
  onBackToCar: () => void
  onAddToCart: (listing: Listing) => void
  isInCart: (listingId: string) => boolean
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Listing[]>([])
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({})
  const [reloadKey, setReloadKey] = useState(0)

  const [sortBy, setSortBy] = usePersistedState<SortKey>('cpf-sort', 'price')
  const [condition, setCondition] = usePersistedState<ConditionFilter>('cpf-condition', 'all')
  const [hideOverseas, setHideOverseas] = usePersistedState<boolean>('cpf-hide-overseas', false)
  const [zip, setZip] = usePersistedState<string>('cpf-zip', '')

  // Only a complete 5-digit ZIP affects results; partial input won't trigger refetches.
  const effectiveZip = /^\d{5}$/.test(zip) ? zip : ''

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    searchParts(car.year, car.make, car.model, part, car.trim, effectiveZip || undefined)
      .then((res) => {
        if (cancelled) return
        setResults(res.results)
        setProviderErrors(res.providerErrors || {})
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [car, part, reloadKey, effectiveZip])

  const bestValueId = useMemo(() => {
    if (results.length === 0) return null
    return [...results].sort((a, b) => valueScore(a) - valueScore(b))[0].id
  }, [results])

  const visible = useMemo(() => {
    let list = results.slice()
    if (condition === 'new') list = list.filter(isNew)
    if (condition === 'used') list = list.filter(isUsed)
    if (hideOverseas) list = list.filter((l) => !l.crossBorder)

    list.sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price
      if (sortBy === 'rating') {
        const ra = a.sellerFeedbackPercentage ? Number(a.sellerFeedbackPercentage) : 0
        const rb = b.sellerFeedbackPercentage ? Number(b.sellerFeedbackPercentage) : 0
        if (rb !== ra) return rb - ra
        return a.price - b.price
      }
      return valueScore(a) - valueScore(b)
    })
    return list
  }, [results, sortBy, condition, hideOverseas])

  const priceRange = useMemo(() => {
    if (visible.length === 0) return null
    const prices = visible.map((l) => l.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [visible])

  const failedProviders = Object.keys(providerErrors)
  const vehicleLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''}`

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <VehicleThumbnail make={car.make} model={car.model} className="h-11 w-16" iconSize={20} />
          <div>
            <h2 className="text-lg font-bold text-slate-900">{part}</h2>
            <p className="text-sm text-slate-500">
              Fitting your <span className="font-medium text-slate-700">{vehicleLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onBackToPart} className="btn btn-ghost px-2.5 py-1.5">
            <ChevronLeft size={16} /> Part
          </button>
          <button type="button" onClick={onBackToCar} className="btn btn-ghost px-2.5 py-1.5">
            Vehicle
          </button>
        </div>
      </div>

      {loading && (
        <ul className="mt-6 flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      )}

      {!loading && error && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <AlertTriangle className="text-red-500" size={28} />
          <p className="mt-2 font-semibold text-red-800">We couldn't complete this search.</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn btn-primary mt-4 px-4 py-2">
            <RotateCw size={15} /> Try again
          </button>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          {failedProviders.length > 0 ? (
            <>
              <AlertTriangle className="text-amber-500" size={28} />
              <p className="mt-2 font-semibold text-slate-700">Couldn't reach {failedProviders.join(' and ')}.</p>
              <p className="mt-1 text-xs text-slate-400">{Object.values(providerErrors)[0]}</p>
            </>
          ) : (
            <>
              <Wrench className="text-slate-300" size={28} />
              <p className="mt-2 font-semibold text-slate-700">No listings found</p>
              <p className="mt-1 text-sm text-slate-500">Try a broader part name or a different vehicle.</p>
            </>
          )}
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn btn-secondary mt-4 px-4 py-2">
            <RotateCw size={15} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <>
          {failedProviders.length > 0 && (
            <p className="mt-5 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle size={14} /> Showing available results — {failedProviders.join(', ')} was unavailable.
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <p className="text-sm text-slate-600">
              <span className="text-base font-bold text-slate-900">{visible.length}</span>{' '}
              {visible.length === 1 ? 'result' : 'results'}
              {priceRange && (
                <span className="text-slate-400">
                  {' '}
                  · ${priceRange.min.toFixed(2)}
                  {priceRange.max !== priceRange.min && `–$${priceRange.max.toFixed(2)}`}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="field w-auto py-1.5 pr-8">
                <option value="price">Cheapest first</option>
                <option value="value">Best value</option>
                <option value="rating">Seller rating</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex gap-1 rounded-lg bg-slate-100 p-1">
              {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition ${
                    condition === c ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
            <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={hideOverseas}
                onChange={(e) => setHideOverseas(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
              />
              Hide overseas
            </label>

            <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Truck size={14} className="text-slate-400" />
              <span className="hidden sm:inline">Deliver to</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))}
                placeholder="ZIP"
                aria-label="Delivery ZIP code"
                className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              No results match these filters.{' '}
              <button
                type="button"
                onClick={() => {
                  setCondition('all')
                  setHideOverseas(false)
                }}
                className="font-semibold text-brand-600 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="mt-5 flex flex-col gap-4">
              {visible.map((listing, i) => {
                const inCart = isInCart(listing.id)
                return (
                  <li
                    key={listing.id}
                    className="group rounded-2xl border border-slate-200 p-4 transition-all duration-150 hover:border-brand-200 hover:shadow-md hover:shadow-slate-900/5"
                  >
                    <div className="flex gap-4">
                      <div className="flex shrink-0 flex-col items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                          {i + 1}
                        </span>
                        {listing.image && (
                          <img
                            src={listing.image}
                            alt=""
                            className="h-24 w-24 rounded-xl border border-slate-100 bg-white object-cover"
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold leading-snug text-slate-900 transition group-hover:text-brand-700">
                            {listing.title}
                          </h3>
                          <div className="shrink-0 text-right">
                            {listing.originalPrice && (
                              <div className="text-xs text-slate-400 line-through">
                                ${listing.originalPrice.toFixed(2)}
                              </div>
                            )}
                            <div className="text-xl font-extrabold tracking-tight text-slate-900">
                              ${listing.price.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                            {listing.condition}
                          </span>
                          <span className="truncate">
                            {listing.seller} on {listing.source}
                            {listing.sellerFeedbackPercentage && (
                              <span className="inline-flex items-center gap-0.5">
                                {' '}
                                · <Star size={12} className="fill-amber-400 text-amber-400" />
                                {listing.sellerFeedbackPercentage}%
                                {listing.sellerFeedbackScore
                                  ? ` (${listing.sellerFeedbackScore.toLocaleString()})`
                                  : ''}
                              </span>
                            )}
                          </span>
                        </p>
                        {listing.itemLocation && (
                          <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                            <MapPin size={13} /> {listing.itemLocation}
                          </p>
                        )}
                        {(shippingLabel(listing) || deliveryLabel(listing)) && (
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                              <Truck size={13} className="text-slate-400" />
                              {shippingLabel(listing) === 'Free shipping' ? (
                                <span className="font-semibold text-emerald-600">Free shipping</span>
                              ) : (
                                shippingLabel(listing)
                              )}
                            </span>
                            {deliveryLabel(listing) && (
                              <span className="text-slate-500">
                                · {deliveryLabel(listing)}
                                {effectiveZip && <span className="text-slate-400"> to {effectiveZip}</span>}
                              </span>
                            )}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {listing.id === bestValueId && (
                            <span className="badge bg-emerald-100 text-emerald-800">
                              <Sparkles size={12} /> Best value
                            </span>
                          )}
                          {listing.topRatedSeller && (
                            <span className="badge bg-brand-100 text-brand-800">
                              <Award size={12} /> Top Rated
                            </span>
                          )}
                          {listing.bestOfferAccepted && (
                            <span className="badge bg-slate-100 text-slate-700">Best Offer</span>
                          )}
                          {listing.originalPrice && listing.discountPercentage && (
                            <span className="badge bg-rose-100 text-rose-700">
                              <Tag size={12} /> {listing.discountPercentage}% off
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {listing.shortDescription && (
                      <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
                        {listing.shortDescription}
                      </p>
                    )}

                    {listing.crossBorder && (
                      <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        Ships from {listing.shipsFrom ?? 'overseas'} · est. {listing.estimatedDelivery ?? 'several weeks'} ·
                        verify quality before buying safety-critical parts
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={listing.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary px-4 py-2"
                      >
                        View on {listing.source} <ExternalLink size={14} />
                      </a>
                      <button
                        type="button"
                        disabled={inCart}
                        onClick={() => onAddToCart(listing)}
                        className={`btn px-4 py-2 ${
                          inCart
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'btn-secondary'
                        }`}
                      >
                        {inCart ? (
                          <>
                            <Check size={15} /> Added
                          </>
                        ) : (
                          <>
                            <Plus size={15} /> Add to cart
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {!loading && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Store size={16} className="text-slate-400" /> Compare prices at other stores
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            These retailers don't offer price data we can show here — each link opens their search for this exact
            part in a new tab.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {retailerLinks.map((retailer) => (
              <a
                key={retailer.name}
                href={retailer.buildUrl(`${vehicleLabel} ${part}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
              >
                {retailer.name} <ExternalLink size={13} className="text-slate-400" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
