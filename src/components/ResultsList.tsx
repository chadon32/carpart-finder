import { useEffect, useMemo, useState, Suspense, lazy } from 'react'
import {
  ChevronLeft,
  Wrench,
  AlertTriangle,
  BookmarkPlus,
  ExternalLink,
  Check,
  RotateCw,
  SlidersHorizontal,
  Truck,
  Store,
  Share2,
  TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Helmet } from 'react-helmet-async'
import type { Car } from './CarSelector'
import { searchParts, fetchPriceHistory, type Listing, type PriceObservation } from '../api/client'
import { usePersistedState } from '../hooks/usePersistedState'
import { VehicleThumbnail } from './VehicleThumbnail'
import { retailerLinks } from '../data/retailerLinks'
import { Sparkline } from './Sparkline'
import { companionsForPart } from '../data/partTypes'
import { isElectricVehicle } from '../data/electricVehicles'
import { trackEvent, trackRetailerClick } from '../lib/analytics'
import { saveSearch, ApiError } from '../api/supabase'
// Modals only render on user interaction (opening a listing / comparing), so
// split them out of the main results bundle and load on demand.
const PartDetailModal = lazy(() => import('./PartDetailModal').then((m) => ({ default: m.PartDetailModal })))
const ComparisonModal = lazy(() => import('./ComparisonModal').then((m) => ({ default: m.ComparisonModal })))

import { PriceAlertCard } from './PriceAlertCard'
import { FilterSheet } from './FilterSheet'
import { ListingCard } from './ListingCard'
import { RadarMark } from './RadarMark'
import { isNew, isUsed, valueScore } from '../lib/listingHelpers'
import { maintenanceKitForSearch } from '../data/maintenanceKits'
import { AffiliateDisclosure } from './AffiliateDisclosure'

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
  onSearchPart,
  onOpenAccount,
}: {
  car: Car
  part: string
  onBackToPart: () => void
  onBackToCar: () => void
  onAddToWatchlist: (listing: Listing) => void
  isInWatchlist: (listingId: string) => boolean
  onSearchPart?: (part: string) => void
  onOpenAccount: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Listing[]>([])
  const [fallbackResults, setFallbackResults] = useState<Listing[]>([])
  const [hiddenIrrelevantFallbacks, setHiddenIrrelevantFallbacks] = useState(0)
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
  const [showFilters, setShowFilters] = useState(false)

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
        setFallbackResults(res.fallbackResults || [])
        setHiddenIrrelevantFallbacks(res.fitmentSummary?.hiddenIrrelevantFallbacks ?? 0)
        setProviderErrors(res.providerErrors || {})
        setStale(Boolean(res.stale))
        trackEvent('Search Results Viewed', {
          year: car.year,
          make: car.make,
          model: car.model,
          trim: car.trim || undefined,
          part,
          verifiedCount: res.results.length,
          fallbackCount: res.fallbackResults?.length ?? 0,
          stale: Boolean(res.stale),
        })
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

  // Real observed daily lows for this search signature. Absence is normal
  // (history only accrues once Supabase is configured), so errors just hide it.
  const [history, setHistory] = useState<PriceObservation[]>([])

  useEffect(() => {
    let cancelled = false
    setHistory([])
    fetchPriceHistory(car.year, car.make, car.model, part)
      .then((res) => {
        if (!cancelled) setHistory(res.observations)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [car.year, car.make, car.model, part])

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

  const visibleFallbacks = useMemo(() => {
    let list = fallbackResults.slice()
    if (condition === 'new') list = list.filter(isNew)
    if (condition === 'used') list = list.filter(isUsed)
    if (hideOverseas) list = list.filter((listing) => !listing.crossBorder)
    if (filterFastDelivery) {
      const cutoff = Date.now() + 7 * 24 * 60 * 60 * 1000
      list = list.filter((listing) => listing.deliveryMax && new Date(listing.deliveryMax).getTime() <= cutoff)
    }
    if (minRating > 0) {
      list = list.filter((listing) => Number(listing.sellerFeedbackPercentage ?? 0) >= minRating)
    }
    list.sort((a, b) => {
      if (sortBy === 'rating') {
        const aRating = Number(a.sellerFeedbackPercentage ?? 0)
        const bRating = Number(b.sellerFeedbackPercentage ?? 0)
        if (bRating !== aRating) return bRating - aRating
      }
      return (a.price + (a.shippingCost || 0)) - (b.price + (b.shippingCost || 0))
    })
    return list
  }, [fallbackResults, sortBy, condition, hideOverseas, filterFastDelivery, minRating])

  const hasComparison = visible.length >= 2

  const bestValueId = useMemo(() => {
    if (visible.length < 2) return null
    return [...visible].sort((a, b) => valueScore(a) - valueScore(b))[0].id
  }, [visible])

  const cheapestId = useMemo(() => {
    if (visible.length < 2) return null
    return [...visible].sort((a, b) => (a.price + (a.shippingCost || 0)) - (b.price + (b.shippingCost || 0)))[0].id
  }, [visible])

  const priceRange = useMemo(() => {
    if (visible.length === 0) return null
    const prices = visible.map((l) => l.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [visible])

  const activeFilterCount =
    (condition !== 'all' ? 1 : 0) +
    (hideOverseas ? 1 : 0) +
    (filterFastDelivery ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (effectiveZip ? 1 : 0)

  const clearFilters = () => {
    setCondition('all')
    setHideOverseas(false)
    setFilterFastDelivery(false)
    setMinRating(0)
    setZip('')
  }

  const companions = useMemo(
    () => companionsForPart(part, isElectricVehicle(car.make, car.model)),
    [part, car.make, car.model]
  )
  const maintenanceKit = useMemo(() => maintenanceKitForSearch(part), [part])

  const failedProviders = Object.keys(providerErrors)
  const vehicleLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''}`

  const trackListingClick = (listing: Listing) => {
    trackRetailerClick({
      retailer: listing.source,
      placement: 'listing',
      vehicleLabel,
      part,
      listingId: listing.id,
      fitmentStatus: listing.verifiedFitment === true ? 'verified' : 'unverified',
    })
  }

  const searchCompanion = (to: string, location: 'results-aside' | 'detail-modal') => {
    if (!onSearchPart) return
    trackEvent('Companion Part Clicked', { from: part, to, location, vehicleString: vehicleLabel })
    setSelectedListing(null)
    onSearchPart(to)
  }
  const pageTitle = `${vehicleLabel} ${part} — Compare Prices on CarPartsRadar`
  const pageDescription = `Review marketplace compatibility matches and broader ${part} search results for a ${vehicleLabel}.`

  return (
    <>
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
    </Helmet>
    
    <div className="card min-w-0 max-w-full overflow-hidden p-4 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-full items-center gap-3">
          <VehicleThumbnail make={car.make} model={car.model} year={car.year} className="h-11 w-16" iconSize={20} />
          <div className="min-w-0">
            <h1 aria-label={`${part}${part.toLowerCase().includes('kit') ? ' (kit search)' : ''}`} className="section-title break-anywhere flex min-w-0 flex-wrap items-center gap-2">
              {part}
              {part.toLowerCase().includes('kit') && (
                <span className="badge shrink-0 bg-brand-600 px-2 text-white shadow-sm">Kit search</span>
              )}
            </h1>
            <p className="text-sm text-slate-500">
              Marketplace search for <span className="font-medium text-slate-700">{vehicleLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onBackToPart} className="btn btn-ghost px-2.5 py-1.5">
            <ChevronLeft size={16} /> Part
          </button>
          <button type="button" onClick={onBackToCar} className="btn btn-ghost hidden px-2.5 py-1.5 sm:inline-flex">
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
                toast.success('Search saved')
                setTimeout(() => setSaveState('idle'), 2500)
              } catch (err) {
                // 401 = not signed in; anything else is a real server/network
                // failure and shouldn't be mislabeled as an auth problem.
                const isAuth = err instanceof ApiError && err.status === 401
                setSaveState(isAuth ? 'auth' : 'error')
                toast.error(isAuth ? 'Sign in or create an account to save this search' : "Couldn't save — try again")
                if (!isAuth) setTimeout(() => setSaveState('idle'), 3500)
              }
            }}
            aria-label="Save search"
            className={`btn btn-accent px-4 py-2 text-xs flex items-center gap-1.5 shadow-md ${
              saveState === 'error' ? 'bg-rose-600 hover:bg-rose-700' : saveState === 'auth' ? 'bg-brand-700 hover:bg-brand-800' : ''
            }`}
          >
            {saveState === 'saved' && <Check size={13} className="text-emerald-600 animate-scale-up" />}
            <BookmarkPlus size={15} className="sm:hidden" />
            <span className="hidden sm:inline">
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved!'
                  : saveState === 'auth'
                    ? 'Sign in to save'
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
            aria-label="Copy share link"
            className="btn btn-ghost min-h-11 min-w-11 px-3 py-1.5 text-xs flex items-center justify-center gap-1.5"
          >
            {copied ? <Check size={13} className="text-emerald-600 animate-scale-up" /> : <Share2 size={13} />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>

      <AffiliateDisclosure className="mt-4" />

      {saveState === 'auth' && (
        <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
          <span>Sign in or create an account to save this search.</span>
          <button type="button" onClick={onOpenAccount} className="btn btn-secondary shrink-0 px-3 py-1.5 text-xs">
            Sign in or create an account
          </button>
        </div>
      )}

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
          <p className="break-anywhere mt-1 max-w-full text-xs text-red-500">{error}</p>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn btn-primary mt-4 px-5 py-2">
            <RotateCw size={15} /> Try again
          </button>
        </div>
      )}

      {!loading && !error && results.length === 0 && fallbackResults.length === 0 && (
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
              <p className="mt-2 font-semibold text-slate-700">
                {maintenanceKit ? `No combined ${maintenanceKit.title.toLowerCase()} kit found` : 'No listings found'}
              </p>
              <p className="mt-1 max-w-lg text-sm text-slate-500">
                {maintenanceKit
                  ? 'A single bundled listing is not available right now. Search the components separately and verify each item before buying.'
                  : 'Try a broader part name or a different vehicle.'}
              </p>
              {hiddenIrrelevantFallbacks > 0 && (
                <p className="mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
                  We excluded {hiddenIrrelevantFallbacks} accessory-only marketplace {hiddenIrrelevantFallbacks === 1 ? 'listing' : 'listings'} instead of presenting them as matches for {part}.
                </p>
              )}
              {maintenanceKit && onSearchPart && (
                <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2" aria-label="Search kit components separately">
                  {maintenanceKit.components.map((component) => (
                    <button
                      key={component}
                      type="button"
                      onClick={() => onSearchPart(component)}
                      className="btn btn-secondary"
                    >
                      Search {component}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onBackToPart} className="btn btn-primary px-5 py-2">
              Choose another part
            </button>
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn btn-secondary px-5 py-2">
              <RotateCw size={15} /> Retry search
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (results.length > 0 || fallbackResults.length > 0) && (
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

          {results.length === 0 && (
            <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100" aria-labelledby="no-verified-matches">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h2 id="no-verified-matches" className="font-semibold">No marketplace-confirmed matches found</h2>
                  <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                    We will not call broad keyword results a fit for your {vehicleLabel}. Confirm the original part number,
                    engine, drivetrain, dimensions, and options before considering the separate marketplace results below.
                  </p>
                  {maintenanceKit && onSearchPart && (
                    <div className="mt-3 flex flex-wrap gap-2" aria-label="Search maintenance components separately">
                      {maintenanceKit.components.map((component) => (
                        <button key={component} type="button" onClick={() => onSearchPart(component)} className="btn btn-secondary">
                          Search {component}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Mobile toolbar: one thumb-scrollable row; detail filters live in the sheet */}
          <div className="-mx-6 mt-6 flex items-center gap-2 overflow-x-auto scrollbar-none px-6 sm:hidden">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="btn btn-secondary relative shrink-0 px-4 text-xs"
            >
              <SlidersHorizontal size={15} /> Filters
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="inline-flex shrink-0 gap-0.5 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`min-h-11 touch-manipulation rounded-full px-4 text-xs font-semibold capitalize transition ${condition === c ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600'}`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort listings"
              className="field w-auto shrink-0 py-2.5 pr-8 text-xs font-semibold"
            >
              <option value="price">Cheapest first</option>
              <option value="value">Best value</option>
              <option value="rating">Seller rating</option>
            </select>
          </div>

          <div className="mt-6 hidden flex-wrap items-center justify-between gap-3 sm:flex">
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
                aria-label="Sort listings"
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

          <div className="mt-6 grid min-w-0 gap-8 md:grid-cols-12">
            <div className="min-w-0 md:col-span-7 xl:col-span-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
                <div>
                  <div className="eyebrow text-brand-600 dark:text-brand-400">Marketplace compatibility matches</div>
                  <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">
                    We rank listings with marketplace compatibility evidence first. A shared part may be titled for another vehicle, so open Details to review the match before buying.
                  </p>
                  <div className="font-display text-3xl text-slate-950">
                    {visible.length} {visible.length === 1 ? 'listing' : 'listings'}
                    {priceRange && (
                      <span className="font-data ml-2 inline-block text-base font-normal text-slate-500">
                        {priceRange.min === priceRange.max
                          ? `$${priceRange.min.toFixed(2)}`
                          : `$${priceRange.min.toFixed(2)} – $${priceRange.max.toFixed(2)}`}
                      </span>
                    )}
                  </div>
                  {!hasComparison && visible.length === 1 && (
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                      Only one matching marketplace listing is available, so there is not enough data for a price comparison. Check the other-store searches below.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeFilterCount > 0 && visible.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="btn btn-ghost px-3 py-1.5 text-xs dark:text-sky-300 dark:hover:text-sky-200"
                    >
                      Clear filters
                    </button>
                  )}
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

              {results.length > 0 && visible.length === 0 && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
                  No listings match these filters.{' '}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="py-2 font-semibold text-brand-700 underline hover:text-brand-800 dark:text-sky-300 dark:hover:text-sky-200"
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
                      onOutboundClick={() => trackListingClick(listing)}
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

              {!maintenanceKit && visibleFallbacks.length > 0 && (
                <section className="mt-10 border-t border-slate-200 pt-7 dark:border-slate-800" aria-labelledby="fallback-results-heading">
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                    <h2 id="fallback-results-heading" className="font-semibold text-amber-950 dark:text-amber-100">
                      Other marketplace keyword results
                    </h2>
                  <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                    These {visibleFallbacks.length} listings mention the part or vehicle terms, but the marketplace did not
                    confirm compatibility. They are not ranked as recommendations and are never used for automatic quotes or repair guides.
                  </p>
                  {hiddenIrrelevantFallbacks > 0 && (
                    <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                      We also left out {hiddenIrrelevantFallbacks} accessory-only marketplace {hiddenIrrelevantFallbacks === 1 ? 'listing' : 'listings'} that did not clearly match {part}.
                    </p>
                  )}
                  </div>
                  <ul className="flex flex-col gap-4">
                    {visibleFallbacks.map((listing, index) => {
                      const inWatchlist = isInWatchlist(listing.id)
                      return (
                        <ListingCard
                          key={listing.id}
                          listing={listing}
                          index={visible.length + index}
                          isBestValue={false}
                          isCheapest={false}
                          inWatchlist={inWatchlist}
                          isComparing={compareList.some((item) => item.id === listing.id)}
                          effectiveZip={effectiveZip}
                          onSelect={setSelectedListing}
                          onAddToWatchlist={onAddToWatchlist}
                          onOutboundClick={() => trackListingClick(listing)}
                          onToggleCompare={(item) => {
                            const selected = compareList.some((comparison) => comparison.id === item.id)
                            if (selected) {
                              setCompareList(compareList.filter((comparison) => comparison.id !== item.id))
                            } else if (compareList.length < 4) {
                              setCompareList([...compareList, item])
                            }
                          }}
                        />
                      )
                    })}
                  </ul>
                </section>
              )}
            </div>

            <aside className="min-w-0 space-y-6 md:col-span-5 xl:col-span-4">
              {companions.length > 0 && onSearchPart && (
                <div className="card p-6">
                  <div className="flex items-center gap-3">
                    <div className="icon-tile bg-brand-600 text-white"><Wrench size={17} /></div>
                    <div>
                      <div className="font-semibold tracking-tight text-slate-950">Complete the job</div>
                      <div className="text-xs text-slate-500">Commonly replaced together — searches your {car.year} {car.make} {car.model}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {companions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => searchCompanion(c, 'results-aside')}
                        className="btn btn-secondary px-3.5 py-2 text-xs"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                        onClick={() => trackRetailerClick({
                          retailer: retailer.name,
                          placement: 'store-comparison',
                          vehicleLabel,
                          part,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700"
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

              {history.length >= 5 && (
                <div className="card p-6">
                  <div className="flex items-center gap-3">
                    <div className="icon-tile bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400"><TrendingDown size={17} /></div>
                    <div>
                      <div className="font-semibold tracking-tight text-slate-950">Price radar — observed lows</div>
                      <div className="text-xs text-slate-500">Lowest daily total we've actually seen for this search</div>
                    </div>
                  </div>
                  <div className="mt-4 text-brand-600 dark:text-brand-400">
                    <Sparkline points={history} />
                  </div>
                  <div className="font-data mt-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
                    <span>Low ${Math.min(...history.map((p) => p.price)).toFixed(2)}</span>
                    <span>High ${Math.max(...history.map((p) => p.price)).toFixed(2)}</span>
                    <span>Since {new Date(`${history[0].date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              )}

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
            vehicle={car}
            vehicleLabel={vehicleLabel}
            part={part}
            companions={companions}
            onSearchPart={onSearchPart ? (p) => searchCompanion(p, 'detail-modal') : undefined}
            onClose={() => setSelectedListing(null)}
            onAddToWatchlist={() => {
              onAddToWatchlist(selectedListing)
              setSelectedListing(null)
            }}
            isInWatchlist={isInWatchlist(selectedListing.id)}
          />
        </Suspense>
      )}

      {showCompareModal && compareList.length > 1 && (
        <Suspense fallback={null}>
          <ComparisonModal listings={compareList} onClose={() => setShowCompareModal(false)} />
        </Suspense>
      )}

      {showFilters && (
        <FilterSheet
          condition={condition}
          onCondition={setCondition}
          hideOverseas={hideOverseas}
          onHideOverseas={setHideOverseas}
          fastDelivery={filterFastDelivery}
          onFastDelivery={setFilterFastDelivery}
          minRating={minRating}
          onMinRating={setMinRating}
          zipInput={zipInput}
          onZipInput={setZipInput}
          onCommitZip={() => {
            if (zipInput === '' || /^\d{5}$/.test(zipInput)) setZip(zipInput)
          }}
          onClearAll={clearFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {compareList.length > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 animate-slide-up items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-2xl shadow-slate-950/20 max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:bottom-6">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[11px] font-extrabold text-white">
              {compareList.length}
            </span>
            <span className="text-xs font-semibold text-slate-200 sm:text-sm">
              {compareList.length === 1 ? 'Select one more part to compare' : `${compareList.length} parts selected to compare`}
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
              disabled={compareList.length < 2}
              className="btn btn-primary rounded-xl px-4 py-1.5 text-xs font-bold"
            >
              {compareList.length < 2 ? 'Select one more' : 'Compare Now'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
