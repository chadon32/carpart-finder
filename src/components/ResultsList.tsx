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
  Package,
  ShieldCheck,
  Share2,
  Mail,
} from 'lucide-react'
import type { Car } from './CarSelector'
import { searchParts, type Listing } from '../api/client'
import { usePersistedState } from '../hooks/usePersistedState'
import { VehicleThumbnail } from './VehicleThumbnail'
import { retailerLinks } from '../data/retailerLinks'
import { PartDetailModal } from './PartDetailModal'
import { saveSearch } from '../api/supabase'
import { ComparisonModal } from './ComparisonModal'

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

function deliveryLabel(l: Listing) {
  if (!l.deliveryMin && !l.deliveryMax) return null
  try {
    const min = l.deliveryMin ? new Date(l.deliveryMin) : null
    const max = l.deliveryMax ? new Date(l.deliveryMax) : null
    if (min && isNaN(min.getTime())) return null
    if (max && isNaN(max.getTime())) return null

    if (min && max && min.toDateString() !== max.toDateString()) {
      if (min.getMonth() === max.getMonth()) {
        return `Arrives ${dateFmt.format(min)}–${max.getDate()}`
      }
      return `Arrives ${dateFmt.format(min)}–${dateFmt.format(max)}`
    }
    const d = max || min
    return d ? `Arrives ${dateFmt.format(d)}` : null
  } catch {
    return null
  }
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
    <li className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800">
      <div className="flex gap-5">
        <div className="h-24 w-24 shrink-0 animate-shimmer rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 w-3/4 animate-shimmer rounded bg-slate-200" />
          <div className="h-3 w-1/2 animate-shimmer rounded bg-slate-100" />
          <div className="mt-4 h-8 w-2/3 animate-shimmer rounded-lg bg-slate-100" />
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
  onAddToWatchlist,
  isInWatchlist,
}: {
  car: Car
  part: string
  onBackToPart: () => void
  onBackToCar: () => void
  onAddToWatchlist: (listing: Listing) => void
  isInWatchlist: (listingId: string) => boolean
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Listing[]>([])
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>({})
  const [stale, setStale] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [sortBy, setSortBy] = usePersistedState<SortKey>('cpf-sort', 'price')
  const [condition, setCondition] = usePersistedState<ConditionFilter>('cpf-condition', 'all')
  const [hideOverseas, setHideOverseas] = usePersistedState<boolean>('cpf-hide-overseas', false)
  const [zip, setZip] = usePersistedState<string>('cpf-zip', '')
  const [zipInput, setZipInput] = useState(zip)

  // Sync if zip is changed externally (e.g. clear filters)
  useEffect(() => {
    setZipInput(zip)
  }, [zip])

  // Real filters only: fast delivery uses eBay's actual delivery estimates,
  // min rating uses real seller feedback percentages.
  const [filterFastDelivery, setFilterFastDelivery] = usePersistedState<boolean>('cpf-fast-shipping', false)
  const [minRating, setMinRating] = usePersistedState<number>('cpf-min-rating', 0)

  // Comparison
  const [compareList, setCompareList] = useState<Listing[]>([])
  const [showCompareModal, setShowCompareModal] = useState(false)

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [copied, setCopied] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const bestPrice = useMemo(() => {
    if (results.length === 0) return 0
    return Math.min(...results.map((r) => r.price))
  }, [results])

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
        setStale(Boolean(res.stale))
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

  // Dynamic JSON-LD Structured Schema Injection for SEO snippets
  useEffect(() => {
    if (results.length === 0) return

    const prices = results.map((r) => r.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      'name': `${car.year} ${car.make} ${car.model} ${part}`,
      'description': `Compare real-time price offers for ${part} on ${car.year} ${car.make} ${car.model} across multiple auto parts stores.`,
      'offers': {
        '@type': 'AggregateOffer',
        'priceCurrency': 'USD',
        'lowPrice': minPrice.toFixed(2),
        'highPrice': maxPrice.toFixed(2),
        'offerCount': results.length,
        'offers': results.map((r) => ({
          '@type': 'Offer',
          'price': r.price.toFixed(2),
          'priceCurrency': 'USD',
          'url': r.link,
          'itemCondition': r.condition === 'new' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
          'seller': {
            '@type': 'Organization',
            'name': r.seller || r.source
          }
        }))
      }
    }

    const script = document.createElement('script')
    script.id = 'jsonld-schema'
    script.type = 'application/ld+json'
    script.innerHTML = JSON.stringify(schema)
    document.head.appendChild(script)

    return () => {
      const existing = document.getElementById('jsonld-schema')
      if (existing) {
        document.head.removeChild(existing)
      }
    }
  }, [results, car, part])

  const bestValueId = useMemo(() => {
    if (results.length === 0) return null
    return [...results].sort((a, b) => valueScore(a) - valueScore(b))[0].id
  }, [results])

  const visible = useMemo(() => {
    let list = results.slice()
    if (condition === 'new') list = list.filter(isNew)
    if (condition === 'used') list = list.filter(isUsed)
    if (hideOverseas) list = list.filter((l) => !l.crossBorder)

    // Fast delivery = eBay's own worst-case estimate arrives within 7 days.
    if (filterFastDelivery) {
      const cutoff = Date.now() + 7 * 24 * 60 * 60 * 1000
      list = list.filter((l) => l.deliveryMax && new Date(l.deliveryMax).getTime() <= cutoff)
    }
    if (minRating > 0) list = list.filter((l) => Number(l.sellerFeedbackPercentage ?? 0) >= minRating)

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

  }, [results, sortBy, condition, hideOverseas, filterFastDelivery, minRating])

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
            <h1 className="text-lg font-bold text-slate-900">{part}</h1>
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
          <button
            type="button"
            disabled={saveState === 'saving'}
            onClick={async () => {
              setSaveState('saving')
              try {
                await saveSearch({
                  year: car.year,
                  make: car.make,
                  model: car.model,
                  trim: car.trim || '',
                  part
                })
                setSaveState('saved')
                setTimeout(() => setSaveState('idle'), 2500)
              } catch {
                setSaveState('error')
                setTimeout(() => setSaveState('idle'), 3500)
              }
            }}
            className={`btn btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5 ${
              saveState === 'error' ? 'text-rose-600' : ''
            }`}
          >
            {saveState === 'saved' && <Check size={13} className="text-emerald-600 animate-scale-up" />}
            <span>
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved!'
                  : saveState === 'error'
                    ? 'Log in to save'
                    : 'Save Search'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="btn btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            {copied ? <Check size={13} className="text-emerald-600 animate-scale-up" /> : <Share2 size={13} />}
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>

      {loading && (
        <ul className="mt-6 flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      )}

      {!loading && error && (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
          <AlertTriangle className="text-red-500" size={28} />
          <p className="mt-2 font-semibold text-red-800">We couldn't complete this search.</p>
          <p className="mt-1 text-xs text-red-500">{error}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn btn-primary mt-4 px-5 py-2">
            <RotateCw size={15} /> Try again
          </button>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
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
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn btn-secondary mt-4 px-5 py-2">
            <RotateCw size={15} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <>
          {stale ? (
            <p className="mt-5 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle size={14} /> Live search is temporarily unavailable — showing recent results from the last hour.
            </p>
          ) : (
            failedProviders.length > 0 && (
              <p className="mt-5 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
                <AlertTriangle size={14} /> Showing available results — {failedProviders.join(', ')} was unavailable.
              </p>
            )
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Condition Filter */}
              <div className="inline-flex gap-0.5 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(c)}
                    className={`rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition ${condition === c ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {c === 'all' ? 'All' : c}
                  </button>
                ))}
              </div>

              {/* Hide Overseas */}
              <label className="filter-pill cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideOverseas}
                  onChange={(e) => setHideOverseas(e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-600"
                />
                Hide overseas
              </label>

              {/* Fast delivery (based on eBay's real delivery estimates) */}
              <button
                type="button"
                onClick={() => setFilterFastDelivery(!filterFastDelivery)}
                className={`filter-pill font-semibold ${filterFastDelivery ? 'filter-pill-active' : 'hover:bg-slate-50'}`}
              >
                Arrives within a week
              </button>

              {/* Minimum Seller Rating */}
              <div className="filter-pill gap-2">
                <span>Min rating</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  aria-label="Minimum seller rating percentage"
                  className="w-20 accent-brand-600"
                />
                <span className="w-8 text-right font-mono">{minRating}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="filter-pill">
                <Truck size={14} className="text-slate-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={zipInput}
                  onChange={(e) => setZipInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => {
                    if (zipInput === '' || /^\d{5}$/.test(zipInput)) {
                      setZip(zipInput)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (zipInput === '' || /^\d{5}$/.test(zipInput)) {
                        setZip(zipInput)
                      }
                    }
                  }}
                  placeholder="ZIP"
                  aria-label="Delivery ZIP code"
                  className="w-14 border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="field w-auto py-2 pr-8 text-xs font-semibold"
              >
                <option value="price">Cheapest first</option>
                <option value="value">Best value</option>
                <option value="rating">Seller rating</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid gap-8 md:grid-cols-12">
            <div className="md:col-span-7 xl:col-span-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
                <div>
                  <div className="eyebrow text-brand-600 dark:text-brand-400">Live eBay listings</div>
                  <div className="text-2xl font-semibold tracking-[-0.4px] text-slate-950">
                    {visible.length} {visible.length === 1 ? 'listing' : 'listings'}
                    {priceRange && (
                      <span className="ml-2 text-base font-normal text-slate-500">
                        ${priceRange.min.toFixed(2)} – ${priceRange.max.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCondition('all')
                      setHideOverseas(false)
                      setFilterFastDelivery(false)
                      setMinRating(0)
                    }}
                    className="btn btn-ghost px-3 py-1.5 text-xs"
                  >
                    Clear filters
                  </button>
                  {compareList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowCompareModal(true)}
                      className="btn btn-primary px-4 py-1.5 text-xs"
                    >
                      Compare ({compareList.length})
                    </button>
                  )}
                </div>
              </div>

              {visible.length === 0 && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  No listings match these filters.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setCondition('all')
                      setHideOverseas(false)
                      setFilterFastDelivery(false)
                      setMinRating(0)
                    }}
                    className="font-semibold text-brand-700 underline hover:text-brand-800"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              <ul className="flex flex-col gap-4">
                {visible.map((listing, i) => {
                  const inWatchlist = isInWatchlist(listing.id)
                  const isBestValue = listing.id === bestValueId
                  return (
                    <li
                      key={listing.id}
                      onClick={(e) => {
                        // Open the detail view unless an inner button/link was the target.
                        if ((e.target as HTMLElement).closest('a,button')) return
                        setSelectedListing(listing)
                      }}
                      className={`listing-card group flex flex-col gap-4 p-5 sm:flex-row sm:items-start cursor-pointer ${isBestValue ? 'ring-1 ring-brand-300/70' : ''}`}
                    >
                      {isBestValue && (
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-teal-600" />
                      )}

                      <div className="relative shrink-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
                          {i + 1}
                        </div>
                        {listing.image ? (
                          <img
                            src={listing.image}
                            alt={listing.title}
                            loading="lazy"
                            width={96}
                            height={96}
                            className="mt-3 h-24 w-24 rounded-xl border border-slate-100 object-cover shadow-sm"
                          />
                        ) : (
                          <div className="mt-3 flex h-24 w-24 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-300">
                            <Package size={30} strokeWidth={1.25} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-col gap-y-1 pr-1 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.1px] text-slate-950 group-hover:text-brand-700">
                              {listing.title}
                            </h3>
                            {isBestValue && (
                              <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 font-extrabold uppercase tracking-wider px-2 py-0.5 text-[9px] shrink-0">
                                Best Value
                              </span>
                            )}
                          </div>
                          <div className="mt-1 shrink-0 text-right sm:mt-0">
                            {listing.originalPrice && (
                              <div className="text-xs text-emerald-600 font-medium">↓ Price dropped</div>
                            )}
                            {listing.originalPrice && <div className="text-xs text-slate-400 line-through">${listing.originalPrice.toFixed(2)}</div>}
                            <div className="font-semibold tracking-[-0.5px] text-slate-950 text-[24px] leading-none">
                              ${listing.price.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                          <span className="badge bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[11px]">{listing.condition}</span>
                          <span className="font-medium">{listing.seller} · {listing.source}</span>
                          {listing.sellerFeedbackPercentage && (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <Star size={13} className="fill-current" /> {listing.sellerFeedbackPercentage}%
                              {listing.sellerFeedbackScore && <span className="text-slate-400">({listing.sellerFeedbackScore.toLocaleString()})</span>}
                            </span>
                          )}
                        </div>

                        {listing.itemLocation && <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} /> {listing.itemLocation}</div>}

                        {(shippingLabel(listing) || deliveryLabel(listing)) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-1 font-medium">
                              <Truck size={13} className="text-slate-400" />
                              {shippingLabel(listing) === 'Free shipping' ? <span className="font-semibold text-emerald-600">Free shipping</span> : shippingLabel(listing)}
                            </span>
                            {deliveryLabel(listing) && <span className="text-slate-500">· {deliveryLabel(listing)}{effectiveZip && ` to ${effectiveZip}`}</span>}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {listing.verifiedFitment === false ? (
                            <span className="badge bg-amber-100 text-amber-800"><AlertTriangle size={12} /> Fitment not verified</span>
                          ) : (
                            <span className="badge bg-emerald-100 text-emerald-800"><ShieldCheck size={12} /> Verified fitment</span>
                          )}
                          {isBestValue && (
                            <span className="group relative badge bg-emerald-100 text-emerald-800 cursor-help">
                              <Sparkles size={12} /> Recommended (Best Value)
                              <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-[10px] font-normal leading-normal text-white opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100">
                                <strong>Best Value Deal:</strong> Calculated by weighing total price (with shipping), seller feedback, and vehicle fitment compatibility.
                                <span className="absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 bg-slate-950 rotate-45" />
                              </span>
                            </span>
                          )}
                          {listing.topRatedSeller && <span className="badge bg-brand-100 text-brand-800"><Award size={12} /> Top Rated</span>}
                          {listing.bestOfferAccepted && <span className="badge bg-slate-100 text-slate-700">Best Offer</span>}
                          {listing.originalPrice && listing.discountPercentage && <span className="badge bg-rose-100 text-rose-700"><Tag size={12} /> {listing.discountPercentage}% off</span>}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <a href={listing.link} target="_blank" rel="noopener noreferrer" className="btn btn-primary px-5 py-2 text-sm">
                            View on {listing.source} <ExternalLink size={14} />
                          </a>
                          <button
                            type="button"
                            disabled={inWatchlist}
                            onClick={() => onAddToWatchlist(listing)}
                            className={`btn px-5 py-2 text-sm ${inWatchlist ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'btn-secondary'}`}
                          >
                            {inWatchlist ? <><Check size={15} /> Watching</> : <><Plus size={15} /> Watch part</>}
                          </button>
                          <button
                            onClick={() => {
                              const isComparing = compareList.some(l => l.id === listing.id)
                              if (isComparing) {
                                setCompareList(compareList.filter(l => l.id !== listing.id))
                              } else if (compareList.length < 4) {
                                setCompareList([...compareList, listing])
                              }
                            }}
                            className="btn btn-ghost px-4 py-2 text-sm"
                          >
                            {compareList.some(l => l.id === listing.id) ? 'Remove' : 'Compare'}
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <aside className="md:col-span-5 xl:col-span-4 space-y-6">
              <div className="card p-6">
                <div className="flex items-center gap-3">
                  <div className="icon-tile bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"><Store size={17} /></div>
                  <div>
                    <div className="font-semibold tracking-tight text-slate-950">Compare at other stores</div>
                    <div className="text-xs text-slate-500">Opens each store's search for this part</div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  {retailerLinks.map((retailer, idx) => {
                    const Icon = retailer.icon
                    // Build a high-quality search query
                    const searchQuery = `${vehicleLabel} ${part}`.trim()
                    return (
                      <a
                        key={idx}
                        href={retailer.buildUrl(searchQuery)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700"
                      >
                        <span className="flex items-center gap-3">
                          <Icon size={17} className={retailer.color} />
                          {retailer.name}
                        </span>
                        <ExternalLink size={14} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                      </a>
                    )
                  })}
                </div>
              </div>

              {bestPrice > 0 && (
                <PriceAlertCard car={car} part={part} targetPrice={bestPrice} />
              )}
            </aside>
          </div>
        </>
      )}

      {selectedListing && (
        <PartDetailModal
          listing={selectedListing}
          vehicleLabel={vehicleLabel}
          part={part}
          onClose={() => setSelectedListing(null)}
          onAddToWatchlist={() => {
            onAddToWatchlist(selectedListing)
            setSelectedListing(null)
          }}
          isInWatchlist={isInWatchlist(selectedListing.id)}
        />
      )}

      {showCompareModal && compareList.length > 0 && (
        <ComparisonModal listings={compareList} onClose={() => setShowCompareModal(false)} />
      )}

      {compareList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 animate-slide-up items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-2xl shadow-slate-950/20 max-w-sm sm:max-w-md w-[calc(100%-2rem)]">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[11px] font-extrabold text-white">
              {compareList.length}
            </span>
            <span className="text-xs font-semibold text-slate-200 sm:text-sm">
              part{compareList.length === 1 ? '' : 's'} selected to compare
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCompareList([])}
              className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className="btn btn-primary rounded-xl px-4 py-1.5 text-xs font-bold"
            >
              Compare Now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PriceAlertCard({ car, part, targetPrice }: { car: Car; part: string; targetPrice: number }) {
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
