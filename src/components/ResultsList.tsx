import { useEffect, useMemo, useState, Suspense, lazy } from 'react'
import {
  ChevronLeft,
  Wrench,
  AlertTriangle,
  ExternalLink,
  Check,
  RotateCw,
  Truck,
  Store,
  Share2,
} from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import type { Car } from './CarSelector'
import { searchParts, type Listing } from '../api/client'
import { usePersistedState } from '../hooks/usePersistedState'
import { VehicleThumbnail } from './VehicleThumbnail'
import { retailerLinks } from '../data/retailerLinks'
import { saveSearch, ApiError } from '../api/supabase'
// Modals only render on user interaction (opening a listing / comparing), so
// split them out of the main results bundle and load on demand.
const PartDetailModal = lazy(() => import('./PartDetailModal').then((m) => ({ default: m.PartDetailModal })))
const ComparisonModal = lazy(() => import('./ComparisonModal').then((m) => ({ default: m.ComparisonModal })))

import { PriceAlertCard } from './PriceAlertCard'
import { ListingCard } from './ListingCard'
import { RadarMark } from './RadarMark'
import { isNew, isUsed, valueScore } from '../lib/listingHelpers'

type SortKey = 'value' | 'price' | 'rating'
type ConditionFilter = 'all' | 'new' | 'used'

function SkeletonCard() {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 min-h-[160px]">
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
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'auth'>('idle')

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
    // Use textContent (not innerHTML) and escape `<` so a seller-controlled
    // listing title containing `</script>` can't break out of this tag and
    // execute — JSON.stringify does not escape forward slashes on its own.
    script.textContent = JSON.stringify(schema).replace(/</g, '\\u003c')
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

  const cheapestId = useMemo(() => {
    if (visible.length === 0) return null
    return [...visible].sort((a, b) => (a.price + (a.shippingCost || 0)) - (b.price + (b.shippingCost || 0)))[0].id
  }, [visible])

  const priceRange = useMemo(() => {
    if (visible.length === 0) return null
    const prices = visible.map((l) => l.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [visible])

  const failedProviders = Object.keys(providerErrors)
  const vehicleLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''}`
  const pageTitle = `${vehicleLabel} ${part} — Compare Prices on CarPartsRadar`
  const pageDescription = `Compare real-time prices for ${part} on a ${vehicleLabel}. Find the cheapest listings with verified fitment across top marketplaces.`

  return (
    <>
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
    </Helmet>
    
    <div className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <VehicleThumbnail make={car.make} model={car.model} year={car.year} className="h-11 w-16" iconSize={20} />
          <div>
            <h1 className="section-title flex items-center gap-2">
              {part}
              {part.toLowerCase().includes('kit') && (
                <span className="badge bg-brand-600 text-white shadow-sm px-2">Bundle Deal</span>
              )}
            </h1>
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
              } catch (err) {
                // 401 = not signed in; anything else is a real server/network
                // failure and shouldn't be mislabeled as an auth problem.
                const isAuth = err instanceof ApiError && err.status === 401
                setSaveState(isAuth ? 'auth' : 'error')
                setTimeout(() => setSaveState('idle'), 3500)
              }
            }}
            className={`btn btn-accent px-4 py-2 text-xs flex items-center gap-1.5 shadow-md ${
              saveState === 'error' || saveState === 'auth' ? 'bg-rose-600 hover:bg-rose-700' : ''
            }`}
          >
            {saveState === 'saved' && <Check size={13} className="text-emerald-600 animate-scale-up" />}
            <span>
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved!'
                  : saveState === 'auth'
                    ? 'Log in to save'
                    : saveState === 'error'
                      ? "Couldn't save — try again"
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
        <>
          {/* The scan in progress — the radar sweep here is the same mark as
              the logo, doing the thing the logo promises. */}
          <div className="font-data mt-6 flex items-center justify-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-400" role="status">
            <RadarMark className="h-5 w-5" />
            Scanning live listings for your {car.year} {car.make} {car.model}
          </div>
          <ul className="mt-4 flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </ul>
        </>
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
                  <div className="font-display text-3xl text-slate-950">
                    {visible.length} {visible.length === 1 ? 'listing' : 'listings'}
                    {priceRange && (
                      <span className="font-data ml-2 text-base font-normal text-slate-500">
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
                  const isCheapest = listing.id === cheapestId
                  return (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      index={i}
                      isBestValue={isBestValue}
                      isCheapest={isCheapest}
                      inWatchlist={inWatchlist}
                      isComparing={compareList.some(l => l.id === listing.id)}
                      effectiveZip={effectiveZip}
                      onSelect={setSelectedListing}
                      onAddToWatchlist={onAddToWatchlist}
                      onToggleCompare={(l) => {
                        const isComparing = compareList.some(comp => comp.id === l.id)
                        if (isComparing) {
                          setCompareList(compareList.filter(comp => comp.id !== l.id))
                        } else if (compareList.length < 4) {
                          setCompareList([...compareList, l])
                        }
                      }}
                    />
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
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {showCompareModal && compareList.length > 0 && (
        <Suspense fallback={null}>
          <ComparisonModal listings={compareList} onClose={() => setShowCompareModal(false)} />
        </Suspense>
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
    </>
  )
}
