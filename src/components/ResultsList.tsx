import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
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
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Car } from './CarSelector'
import type { Listing } from '../api/client'
import type { PartsSearchState } from '../hooks/usePartsSearch'
import { usePersistedState } from '../hooks/usePersistedState'
import { VehicleThumbnail } from './VehicleThumbnail'
import { retailerLinks } from '../data/retailerLinks'
import { PriceHistoryCard } from './PriceHistoryCard'
import { companionsForPart } from '../data/partTypes'
import { isElectricVehicle } from '../data/electricVehicles'
import { trackEvent, trackRetailerClick } from '../lib/analytics'
import { saveSearch, ApiError } from '../api/supabase'
// Modals only render on user interaction (opening a listing / comparing), so
// split them out of the main results bundle and load on demand.
const PartDetailModal = lazyWithRecovery(() => import('./PartDetailModal').then((m) => ({ default: m.PartDetailModal })))
const ComparisonModal = lazyWithRecovery(() => import('./ComparisonModal').then((m) => ({ default: m.ComparisonModal })))

import { PriceAlertCard } from './PriceAlertCard'
const FilterSheet = lazyWithRecovery(() => import('./FilterSheet').then((m) => ({ default: m.FilterSheet })))
import { ListingCard } from './ListingCard'
import { OutboundLink } from './OutboundLink'
import { RadarMark } from './RadarMark'
import {
  compareKnownTotal,
  compareValueEstimate,
  isNew,
  isUsed,
  knownTotalCost,
} from '../lib/listingHelpers'
import { maintenanceKitForSearch } from '../data/maintenanceKits'
import { AffiliateDisclosure } from './AffiliateDisclosure'
import { guideForPart } from '../data/guideSearch'
import { SORT_OPTIONS, type SortKey } from '../lib/listingSort'
import { lazyWithRecovery } from '../lib/lazyWithRecovery'
import { listingPosition, positionChoices, type ListingPosition } from '../lib/listingPosition.js'

type ConditionFilter = 'all' | 'new' | 'used'

function SkeletonCard() {
  // The single radar/status above the list communicates loading. Animating
  // every skeleton segment consumed main-thread time during slow searches.
  return (
    <li className="rounded-2xl border border-line bg-surface p-5 dark:border-slate-800 min-h-[160px]">
      <div className="flex gap-5">
        <div className="h-24 w-24 shrink-0 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 w-3/4 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-surface-3" />
          <div className="mt-4 h-8 w-2/3 rounded-lg bg-surface-3" />
        </div>
      </div>
    </li>
  )
}

type AxleFilter = 'all' | ListingPosition

type ListingFilters = {
  condition: ConditionFilter
  hideOverseas: boolean
  fastDelivery: boolean
  minRating: number
  axle: AxleFilter
}

// Brake pads and suspension parts are sold per axle; the labels match the
// choices offered on the results page.
const AXLE_LABELS: Record<ListingPosition, string> = { front: 'Front', rear: 'Rear', kit: 'Front + rear' }

// Listings shown before "Show more"; the request carries two pages.
const PAGE_SIZE = 15

function applyFilters(listings: Listing[], filters: ListingFilters): Listing[] {
  let list = listings
  if (filters.condition === 'new') list = list.filter(isNew)
  if (filters.condition === 'used') list = list.filter(isUsed)
  if (filters.hideOverseas) list = list.filter((listing) => !listing.crossBorder)
  // Fast delivery = eBay's own worst-case estimate arrives within 7 days.
  if (filters.fastDelivery) {
    const cutoff = Date.now() + 7 * 24 * 60 * 60 * 1000
    list = list.filter((listing) => listing.deliveryMax && new Date(listing.deliveryMax).getTime() <= cutoff)
  }
  if (filters.minRating > 0) {
    list = list.filter((listing) => Number(listing.sellerFeedbackPercentage ?? 0) >= filters.minRating)
  }
  if (filters.axle !== 'all') list = list.filter((listing) => listingPosition(listing.title) === filters.axle)
  return list
}

const sellerRating = (listing: Listing) => (listing.sellerFeedbackPercentage ? Number(listing.sellerFeedbackPercentage) : 0)

function sortListings(listings: Listing[], sortBy: SortKey): Listing[] {
  return [...listings].sort((a, b) => {
    if (sortBy === 'total') return compareKnownTotal(a, b)
    if (sortBy === 'price') return a.price - b.price
    if (sortBy === 'rating') return sellerRating(b) - sellerRating(a) || a.price - b.price
    return compareValueEstimate(a, b)
  })
}

// Other-store searches, shared by the sidebar card and the phone disclosure.
function StoreLinks({ vehicleLabel, part }: { vehicleLabel: string; part: string }) {
  const searchQuery = `${vehicleLabel} ${part}`.trim()
  return (
    <div className="flex flex-col gap-2">
      {retailerLinks.map((retailer) => (
        <OutboundLink
          key={retailer.name}
          href={retailer.buildUrl(searchQuery)}
          onClick={() => trackRetailerClick({
            retailer: retailer.name,
            placement: 'store-comparison',
            vehicleLabel,
            part,
          })}
          className="group flex min-h-11 items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700"
        >
          {retailer.name}
          <ExternalLink size={14} className="text-ink-4 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
        </OutboundLink>
      ))}
    </div>
  )
}

export type ResultsListProps = {
  car: Car
  part: string
  onBackToPart: () => void
  onBackToCar: () => void
  onAddToWatchlist: (listing: Listing) => void
  isInWatchlist: (listingId: string) => boolean
  onSearchPart?: (part: string) => void
  onOpenAccount: () => void
}

const EMPTY_LISTINGS: Listing[] = []
const EMPTY_STRINGS: string[] = []
const EMPTY_PROVIDER_ERRORS: Record<string, string> = {}

export function ResultsList({
  car, part, onBackToPart, onBackToCar, onAddToWatchlist, isInWatchlist,
  onSearchPart, onOpenAccount, search, zip, onZipChange: setZip,
}: ResultsListProps & { search: PartsSearchState; zip: string; onZipChange: (zip: string) => void }) {
  const { loading, error, data, key: searchRequestKey, retry } = search
  const results = data?.results ?? EMPTY_LISTINGS
  const fallbackResults = data?.fallbackResults ?? EMPTY_LISTINGS
  const hiddenIrrelevantFallbacks = data?.fitmentSummary?.hiddenIrrelevantFallbacks ?? 0
  const providerErrors = data?.providerErrors ?? EMPTY_PROVIDER_ERRORS
  const stale = Boolean(data?.stale)

  // Default to what the buyer actually pays: item + known shipping, with
  // unknown shipping last. Item price alone put $1 listings with hidden
  // shipping first. The key changed so returning visitors get this default.
  const [sortBy, setSortBy] = usePersistedState<SortKey>('cpf-sort-v2', 'total')
  const [condition, setCondition] = usePersistedState<ConditionFilter>('cpf-condition', 'all')
  const [hideOverseas, setHideOverseas] = usePersistedState<boolean>('cpf-hide-overseas', false)
  const [zipInput, setZipInput] = useState(zip)

  // Sync if zip is changed externally (e.g. clear filters)
  useEffect(() => {
    setZipInput(zip)
  }, [zip])

  // Real filters only: fast delivery uses eBay's actual delivery estimates,
  // min rating uses real seller feedback percentages.
  const [filterFastDelivery, setFilterFastDelivery] = usePersistedState<boolean>('cpf-fast-shipping', false)
  const [minRating, setMinRating] = usePersistedState<number>('cpf-min-rating', 0)

  // Per-search choices: a new vehicle, part, or ZIP starts from all axles and
  // the first page of listings.
  const [axle, setAxle] = useState<AxleFilter>('all')
  const [pageCount, setPageCount] = useState(PAGE_SIZE)
  useEffect(() => {
    setAxle('all')
    setPageCount(PAGE_SIZE)
  }, [searchRequestKey])

  // Comparison
  const [compareList, setCompareList] = useState<Listing[]>([])
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const openListing = (listing: Listing) => {
    trackEvent('Listing Opened')
    setSelectedListing(listing)
  }
  const [copied, setCopied] = useState(false)
  const copyInFlight = useRef(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mounted = useRef(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'auth'>('idle')

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])

  const copyShareLink = async () => {
    if (copyInFlight.current) return
    copyInFlight.current = true
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setCopied(false)
    try {
      // Clipboard access can be unavailable or denied. Confirm success only
      // after the browser accepts it, and provide a manual recovery path.
      await navigator.clipboard.writeText(window.location.href)
      if (!mounted.current) return
      setCopied(true)
      toast.success('Link copied')
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      if (mounted.current) toast.error('Couldn’t copy the link. Copy the address from your browser’s address bar instead.')
    } finally {
      copyInFlight.current = false
    }
  }

  const bestPrice = useMemo(() => {
    const completeTotals = results
      .map(knownTotalCost)
      .filter((total): total is number => total != null)
    return completeTotals.length > 0 ? Math.min(...completeTotals) : 0
  }, [results])

  const matchingGuide = guideForPart(part)

  const effectiveZip = /^\d{5}$/.test(zip) ? zip : ''
  const trackedResults = useRef<typeof data>(null)

  useEffect(() => {
    if (data && trackedResults.current !== data) {
      trackedResults.current = data
      trackEvent('Search Results Viewed', {
        year: car.year,
        make: car.make,
        model: car.model,
        trim: car.trim || undefined,
        part,
        verifiedCount: data.results.length,
        fallbackCount: data.fallbackResults?.length ?? 0,
        stale: Boolean(data.stale),
      })
    }
  }, [car.year, car.make, car.model, car.trim, part, data])

  // Results contain different products, not offers for a single product.
  // Do not present this internal search as Product/AggregateOffer rich-result data.

  // With nothing marketplace-confirmed, the unconfirmed results ARE the list;
  // they get one honest notice rather than a second, duplicate section. A kit
  // search never lists loose keyword results.
  const noneConfirmed = results.length === 0

  // Per-axle parts (brake pads, rotors, shocks...) are offered as Front, Rear,
  // or a front-and-rear kit when the results really mix them.
  const axleSource = noneConfirmed ? fallbackResults : results
  const axleChoices = useMemo(() => positionChoices(axleSource, part), [axleSource, part])
  const activeAxle: AxleFilter = axleChoices.includes(axle as ListingPosition) ? axle : 'all'
  const axleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const listing of axleSource) {
      const position = listingPosition(listing.title)
      if (position) counts[position] = (counts[position] ?? 0) + 1
    }
    return counts
  }, [axleSource])
  // Rear pads priced below front pads are not a better deal for a front brake
  // job, so no listing is crowned across mixed axles.
  const mixedAxles = axleChoices.length > 0 && activeAxle === 'all'

  const filters = useMemo(
    () => ({ condition, hideOverseas, fastDelivery: filterFastDelivery, minRating, axle: activeAxle }),
    [condition, hideOverseas, filterFastDelivery, minRating, activeAxle],
  )
  const visible = useMemo(() => sortListings(applyFilters(results, filters), sortBy), [results, filters, sortBy])
  const visibleFallbacks = useMemo(
    () => sortListings(applyFilters(fallbackResults, filters), sortBy),
    [fallbackResults, filters, sortBy],
  )

  const bestValueId = useMemo(() => {
    if (mixedAxles) return null
    const complete = visible.filter((listing) => knownTotalCost(listing) != null)
    if (complete.length < 2) return null
    return [...complete].sort(compareValueEstimate)[0].id
  }, [visible, mixedAxles])

  const cheapestId = useMemo(() => {
    if (mixedAxles) return null
    const complete = visible.filter((listing) => knownTotalCost(listing) != null)
    if (complete.length < 2) return null
    return [...complete].sort(compareKnownTotal)[0].id
  }, [visible, mixedAxles])

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

  const kitWithoutMatches = noneConfirmed && Boolean(maintenanceKit)
  const mainListings = kitWithoutMatches ? EMPTY_LISTINGS : noneConfirmed ? visibleFallbacks : visible
  const otherFallbacks = noneConfirmed || maintenanceKit ? EMPTY_LISTINGS : visibleFallbacks
  const shownListings = mainListings.slice(0, pageCount)
  const hiddenListingCount = mainListings.length - shownListings.length
  const hasComparison = mainListings.length >= 2

  // Part-number searches and eBay's more specific model names change what the
  // page can honestly say about the results.
  const partNumberSearch = Boolean(data?.partNumberSearch)
  const statedCount = fallbackResults.filter((listing) => listing.partNumberMatch === 'exact').length
  const matchedModels = data?.fitmentSummary?.matchedModels ?? EMPTY_STRINGS
  const modelVariantOf = (listing: Listing) => {
    const matched = listing.fitmentEvidence?.matchedVehicle?.model
    return matched && matchedModels.includes(matched) ? matched : null
  }
  const priceRange = useMemo(() => {
    if (mainListings.length === 0) return null
    const prices = mainListings.map((l) => l.price)
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [mainListings])

  const failedProviders = Object.keys(providerErrors)
  const vehicleLabel = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ''}`

  // Announced politely once the results are in; the scanning message above
  // covers the wait. The count says what a sighted visitor sees at a glance.
  const resultAnnouncement = loading || error || (results.length === 0 && fallbackResults.length === 0)
    ? ''
    : noneConfirmed
      ? `${mainListings.length} ${mainListings.length === 1 ? 'listing' : 'listings'} for your ${vehicleLabel}, none confirmed to fit.`
      : `${mainListings.length} ${mainListings.length === 1 ? 'listing matches' : 'listings match'} your ${vehicleLabel}.`

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

  const toggleCompare = (listing: Listing) => {
    setCompareList((current) => {
      if (current.some((item) => item.id === listing.id)) return current.filter((item) => item.id !== listing.id)
      return current.length < 4 ? [...current, listing] : current
    })
  }

  const searchCompanion = (to: string, location: 'results-aside' | 'detail-modal') => {
    if (!onSearchPart) return
    trackEvent('Companion Part Clicked', { from: part, to, location, vehicleString: vehicleLabel })
    setSelectedListing(null)
    onSearchPart(to)
  }
  return (
    <>
    <div className="card break-anywhere max-w-full overflow-hidden p-[16px] sm:p-7">
      <div role="status" aria-live="polite" className="sr-only">{resultAnnouncement}</div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          <VehicleThumbnail make={car.make} model={car.model} year={car.year} className="h-[44px] w-[64px]" iconSize={20} />
          <div className="min-w-0 flex-1 basis-40">
            <h1 aria-label={`${part}${part.toLowerCase().includes('kit') ? ' (kit search)' : ''}`} className="section-title break-anywhere flex min-w-0 flex-wrap items-center gap-2">
              {part}
              {part.toLowerCase().includes('kit') && (
                <span className="badge shrink-0 bg-brand-600 px-2 text-white shadow-sm">Kit search</span>
              )}
            </h1>
            <p className="text-sm text-ink-4">
              For your <span className="font-medium text-ink-2">{vehicleLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex max-w-full flex-wrap gap-1">
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
                // Signed out is a prompt (the panel below offers the sign-in),
                // not a failure.
                if (isAuth) toast('Sign in to save this search')
                else toast.error("Couldn't save — try again")
                if (!isAuth) setTimeout(() => setSaveState('idle'), 3500)
              }
            }}
            aria-label="Save search"
            className={`btn btn-secondary px-4 py-2 flex items-center gap-1.5 ${
              saveState === 'error' ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100' : saveState === 'auth' ? 'border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100' : ''
            }`}
          >
            {saveState === 'saved' && <Check size={13} className="text-emerald-600 animate-scale-up" />}
            <BookmarkPlus size={15} className="sm:hidden" />
            <span>
              {saveState === 'saving'
                ? 'Saving…'
                : saveState === 'saved'
                  ? 'Saved!'
                  : saveState === 'auth'
                    ? 'Sign in to save'
                    : saveState === 'error'
                      ? "Couldn't save — try again"
                      : (<>Save<span className="hidden sm:inline"> search</span></>)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => void copyShareLink()}
            aria-label="Copy share link"
            className="btn btn-ghost min-h-11 min-w-11 px-3 py-1.5 flex items-center justify-center gap-1.5"
          >
            {copied ? <Check size={13} className="text-emerald-600 animate-scale-up" /> : <Share2 size={13} />}
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>

      <AffiliateDisclosure inline className="mt-3" />

      {saveState === 'auth' && (
        <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
          <span>Sign in or create an account to save this search.</span>
          <button type="button" onClick={onOpenAccount} className="btn btn-secondary shrink-0 px-3 py-1.5">
            Sign in or create an account
          </button>
        </div>
      )}

      {loading && (
        <>
          {/* The scan in progress — the radar sweep here is the same mark as
              the logo, doing the thing the logo promises. */}
          <div className="mt-6 flex items-center justify-center gap-2.5 text-sm font-semibold text-brand-700 dark:text-brand-400" role="status">
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
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <AlertTriangle className="text-red-500" size={28} />
          <p className="mt-2 font-semibold text-red-800">We couldn't complete this search.</p>
          <p className="break-anywhere mt-1 max-w-full text-sm text-red-700">{error}</p>
          <button type="button" onClick={retry} className="btn btn-primary mt-4 px-5 py-2">
            <RotateCw size={15} /> Try again
          </button>
        </div>
      )}

      {!loading && !error && results.length === 0 && fallbackResults.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-line bg-surface-2 p-8 text-center">
          {failedProviders.length > 0 ? (
            <>
              <AlertTriangle className="text-amber-500" size={28} />
              <p className="mt-2 font-semibold text-ink-2">Couldn't reach {failedProviders.join(' and ')}.</p>
              <p className="mt-1 text-sm text-ink-4">{Object.values(providerErrors)[0]}</p>
            </>
          ) : (
            <>
              <Wrench className="text-slate-300" size={28} />
              <p className="mt-2 font-semibold text-ink-2">
                {maintenanceKit ? `No combined ${maintenanceKit.title.toLowerCase()} kit found` : 'No listings found'}
              </p>
              <p className="mt-1 max-w-lg text-sm text-ink-4">
                {maintenanceKit
                  ? 'A single bundled listing is not available right now. Search the components separately and verify each item before buying.'
                  : 'Try a broader part name or a different vehicle.'}
              </p>
              {hiddenIrrelevantFallbacks > 0 && (
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-4">
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
            <button type="button" onClick={retry} className="btn btn-secondary px-5 py-2">
              <RotateCw size={15} /> Retry search
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (results.length > 0 || fallbackResults.length > 0) && (
        <>
          {stale ? (
            <p className="mt-5 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
              <AlertTriangle size={14} /> Live search is temporarily unavailable — showing recent results from the last hour.
            </p>
          ) : (
            failedProviders.length > 0 && (
              <p className="mt-5 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                <AlertTriangle size={14} /> Showing available results — {failedProviders.join(', ')} was unavailable.
              </p>
            )
          )}

          {noneConfirmed && (
            <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100" aria-labelledby="none-confirmed-heading">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h2 id="none-confirmed-heading" className="font-semibold">
                    {maintenanceKit
                      ? `No ${maintenanceKit.title.toLowerCase()} kit is confirmed for your ${vehicleLabel}`
                      : partNumberSearch
                        ? (statedCount > 0 ? `Listings that mention part number ${part}` : `No listing states part number ${part}`)
                        : `None of these are confirmed for your ${vehicleLabel}`}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                    {maintenanceKit
                      ? 'Search the components separately, and check each part number before buying.'
                      : partNumberSearch
                        ? (statedCount > 0
                          ? `We can't confirm they fit your ${vehicleLabel}. Compare the number with your original part before buying.`
                          : `These are related listings that do not name a different vehicle. We can't confirm they fit your ${vehicleLabel}, so check the part number before buying.`)
                        : "eBay doesn't list your vehicle as compatible with these results. Before buying, check the part number, engine, and dimensions against your original part."}
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

          {/* Where the sidebar drops below the list, other stores are a long
              scroll away, so offer them right under the notice. */}
          {noneConfirmed && (
            <details className="group mt-3 rounded-xl border border-line bg-surface lg:hidden dark:border-slate-800">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                Check other stores
                <ChevronDown size={16} aria-hidden="true" className="transition group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4">
                <StoreLinks vehicleLabel={vehicleLabel} part={part} />
              </div>
            </details>
          )}

          {!kitWithoutMatches && (
            <>
          {/* Below xl: sorting and the detail filters share one sheet;
              the full toolbar only fits on one row from about 1200px up. */}
          <div className="mt-6 flex flex-wrap items-center gap-2 xl:hidden">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="btn btn-secondary relative shrink-0 px-4"
            >
              <SlidersHorizontal size={15} /> Sort &amp; filters
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div role="group" aria-label="Condition" className="ml-auto inline-flex shrink-0 gap-0.5 rounded-full bg-surface p-1 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
              {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  aria-pressed={condition === c}
                  className={`min-h-11 touch-manipulation rounded-full px-3 text-xs font-semibold capitalize transition ${condition === c ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-3'}`}
                >
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 hidden flex-wrap items-center justify-between gap-3 xl:flex">
            <div className="flex flex-wrap items-center gap-2">
              {/* Condition Filter */}
              <div role="group" aria-label="Condition" className="inline-flex h-10 items-center gap-0.5 rounded-full bg-surface p-1 ring-1 ring-slate-200 dark:ring-slate-800">
                {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCondition(c)}
                    aria-pressed={condition === c}
                    className={`h-8 rounded-full px-3 text-sm font-semibold capitalize transition ${condition === c ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-surface-2'}`}
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
                aria-pressed={filterFastDelivery}
                className={`filter-pill font-semibold ${filterFastDelivery ? 'filter-pill-active' : 'hover:bg-surface-2'}`}
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
                  className="w-16 accent-brand-600"
                />
                <span className="w-8 text-right font-mono">{minRating}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="filter-pill">
                <Truck size={14} className="text-ink-5" />
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
                  className="w-14 border-0 bg-transparent p-0 text-sm font-semibold text-ink placeholder:text-ink-5 focus:outline-none"
                />
              </div>

              <select
                aria-label="Sort listings"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="field min-h-10 w-auto rounded-full py-2 pl-3.5 pr-8 text-sm font-semibold"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          </>
          )}

          <div className="mt-6 grid min-w-0 gap-8 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-7 xl:col-span-8">
              {!kitWithoutMatches && (
                <>
              {/* One summary block: heading, count, then the fit note carrying
                  the guide link, instead of four separate rows above the first
                  listing. */}
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
                <div className="min-w-0 max-w-full flex-1">
                  <div className="flex flex-col gap-y-1">
                    {!noneConfirmed && <h2 className="text-base font-semibold text-ink">Matches for your {vehicleLabel}</h2>}
                    <div className="font-display text-2xl text-ink sm:text-3xl">
                      {mainListings.length}{' '}
                      {noneConfirmed && !partNumberSearch
                        ? (mainListings.length === 1 ? 'possible match' : 'possible matches')
                        : (mainListings.length === 1 ? 'listing' : 'listings')}
                      {priceRange && (
                        <span className="font-data ml-2 inline-block max-w-full text-base font-normal text-ink-4">
                          {priceRange.min === priceRange.max
                            ? `$${priceRange.min.toFixed(2)}`
                            : `$${priceRange.min.toFixed(2)} – $${priceRange.max.toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {(!noneConfirmed || matchingGuide) && (
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-3">
                      {!noneConfirmed && (
                        <>eBay lists your year, make, and model as compatible. Trim, engine, and options can differ, so check Details before you buy.{' '}</>
                      )}
                      {!noneConfirmed && matchedModels.length > 0 && (
                        <>eBay lists this vehicle as {new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(matchedModels)}; each listing shows which one it matches.{' '}</>
                      )}
                      {matchingGuide && (
                        <a
                          href={`/guides/${matchingGuide.id}.html`}
                          className="font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-800 dark:text-brand-300 dark:decoration-brand-700 dark:hover:text-brand-200"
                        >
                          Read the matching guide: {matchingGuide.title}
                        </a>
                      )}
                    </p>
                  )}
                  {axleChoices.length > 0 && (
                    <div role="group" aria-label="Axle" className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs font-semibold text-ink-3">Sold per axle:</span>
                      {(['all', ...axleChoices] as AxleFilter[]).map((choice) => {
                        const label = choice === 'all' ? `All ${axleSource.length}` : `${AXLE_LABELS[choice]} ${axleCounts[choice] ?? 0}`
                        return (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => setAxle(choice)}
                            aria-pressed={activeAxle === choice}
                            className={`min-h-11 touch-manipulation rounded-full px-3.5 text-xs font-semibold transition sm:min-h-9 ${activeAxle === choice ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface text-ink-2 ring-1 ring-slate-200 hover:bg-surface-2 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700'}`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {!hasComparison && mainListings.length === 1 && (
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-amber-700 dark:text-amber-300">
                      Only one {noneConfirmed ? 'possible match' : 'matching listing'} is available, so there is not enough data for a price comparison. Check the other-store searches below.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeFilterCount > 0 && mainListings.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="btn btn-ghost px-3 py-1.5 dark:text-sky-300 dark:hover:text-sky-200"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {mainListings.length === 0 && (
                <div className="rounded-2xl border border-line bg-surface-2 p-8 text-center text-sm text-ink-3">
                  No listings match these filters.{' '}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="min-h-11 py-2 font-semibold text-brand-700 underline hover:text-brand-800 dark:text-sky-300 dark:hover:text-sky-200"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              <ul className="flex flex-col gap-4">
                {shownListings.map((listing) => {
                  const inWatchlist = isInWatchlist(listing.id)
                  const isBestValue = listing.id === bestValueId
                  const isCheapest = listing.id === cheapestId
                  return (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      isBestValue={isBestValue}
                      isCheapest={isCheapest}
                      inWatchlist={inWatchlist}
                      isComparing={compareList.some(l => l.id === listing.id)}
                      effectiveZip={effectiveZip}
                      modelVariant={modelVariantOf(listing)}
                      onSelect={openListing}
                      onAddToWatchlist={onAddToWatchlist}
                      onOutboundClick={() => trackListingClick(listing)}
                      onToggleCompare={toggleCompare}
                    />
                  )
                })}
              </ul>

              {hiddenListingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPageCount((count) => count + PAGE_SIZE)}
                  className="btn btn-secondary mt-4 w-full px-5 py-2.5"
                >
                  Show {Math.min(PAGE_SIZE, hiddenListingCount)} more {Math.min(PAGE_SIZE, hiddenListingCount) === 1 ? 'listing' : 'listings'}
                </button>
              )}

              {otherFallbacks.length > 0 && (
                <section className="mt-10 border-t border-line pt-7 dark:border-slate-800" aria-labelledby="fallback-results-heading">
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                    <h2 id="fallback-results-heading" className="font-semibold text-amber-950 dark:text-amber-100">
                      More results that do not list your vehicle
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200">
                      These {otherFallbacks.length} mention {part}, but eBay doesn't list your vehicle as compatible. Check the part number before buying. They are not ranked as fitting choices and are never used for quotes or repair guides.
                    </p>
                    {hiddenIrrelevantFallbacks > 0 && (
                      <p className="mt-2 text-sm leading-relaxed text-amber-800 dark:text-amber-300">
                        We also hid {hiddenIrrelevantFallbacks} accessory-only {hiddenIrrelevantFallbacks === 1 ? 'listing' : 'listings'} that did not clearly match {part}.
                      </p>
                    )}
                  </div>
                  <ul className="flex flex-col gap-4">
                    {otherFallbacks.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        isBestValue={false}
                        isCheapest={false}
                        inWatchlist={isInWatchlist(listing.id)}
                        isComparing={compareList.some((item) => item.id === listing.id)}
                        effectiveZip={effectiveZip}
                        onSelect={openListing}
                        onAddToWatchlist={onAddToWatchlist}
                        onOutboundClick={() => trackListingClick(listing)}
                        onToggleCompare={toggleCompare}
                      />
                    ))}
                  </ul>
                </section>
              )}
                </>
              )}
            </div>

            <aside className="min-w-0 space-y-6 lg:col-span-5 xl:col-span-4">
              {companions.length > 0 && onSearchPart && (
                <div className="card p-[16px] sm:p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="icon-tile bg-brand-600 text-white"><Wrench size={17} /></div>
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="font-semibold tracking-tight text-ink">Complete the job</div>
                      <div className="text-xs text-ink-4">Commonly replaced together — searches your {car.year} {car.make} {car.model}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {companions.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => searchCompanion(c, 'results-aside')}
                        className="btn btn-secondary px-3.5 py-2"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="card p-[16px] sm:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="icon-tile bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"><Store size={17} /></div>
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="font-semibold tracking-tight text-ink">Compare at other stores</div>
                    <div className="text-xs text-ink-4">Opens each store's search for this part</div>
                  </div>
                </div>

                <div className="mt-5">
                  <StoreLinks vehicleLabel={vehicleLabel} part={part} />
                </div>
              </div>

              {/* Keyed to the completed search so old history is cancelled
                  and cleared without re-rendering the entire results screen. */}
              <PriceHistoryCard key={searchRequestKey} car={car} part={part} />

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
          <ComparisonModal listings={compareList} vehicle={car} part={part} onClose={() => setShowCompareModal(false)} />
        </Suspense>
      )}

      {showFilters && (
        <Suspense fallback={(
          <div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45">
            <div className="rounded-xl bg-surface px-5 py-3 text-sm font-semibold text-ink-2 shadow-overlay">Loading filters…</div>
          </div>
        )}>
        <FilterSheet
          sortBy={sortBy}
          onSortBy={setSortBy}
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
        </Suspense>
      )}

      {compareList.length > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 animate-slide-up items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-overlay max-w-sm sm:max-w-md w-[calc(100%-2rem)] sm:bottom-6">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs font-extrabold text-white">
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
              className="min-h-11 rounded-xl px-3 py-1.5 text-xs font-bold text-ink-5 hover:text-white hover:bg-slate-900 transition"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              disabled={compareList.length < 2}
              className="btn btn-primary rounded-xl px-4 py-1.5 font-bold"
            >
              {compareList.length < 2 ? 'Select one more' : 'Compare now'}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
