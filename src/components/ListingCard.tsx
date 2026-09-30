import { useId, useState } from 'react'
import { Star, Award, Tag, Sparkles, MapPin, AlertTriangle, ExternalLink, Check, Plus, Package, Truck, ShieldCheck } from 'lucide-react'
import type { Listing } from '../api/client'
import { deliveryLabel, knownTotalCost, shippingLabel } from '../lib/listingHelpers'
import { useIsMobile } from '../hooks/useIsMobile'
import { OutboundLink } from './OutboundLink'

interface ListingCardProps {
  listing: Listing
  index: number
  isBestValue: boolean
  isCheapest: boolean
  inWatchlist: boolean
  isComparing: boolean
  effectiveZip: string
  onSelect: (listing: Listing) => void
  onAddToWatchlist: (listing: Listing) => void
  onToggleCompare: (listing: Listing) => void
  onOutboundClick: () => void
}

const VALUE_ESTIMATE_EXPLANATION =
  'A deterministic comparison of item price, known shipping (before tax), seller feedback (assumes 92% when missing), and top-rated status. Confirm engine and option details before purchase.'

// Total-with-shipping note. Unknown shipping says so instead of implying a
// total; free shipping needs no second number because the price is the total.
function TotalNote({ listing, knownTotal }: { listing: Listing; knownTotal: number | null }) {
  if (knownTotal == null) {
    return <div className="mt-1 max-w-56 text-xs font-semibold text-amber-700 dark:text-amber-300">Shipping shown at checkout</div>
  }
  if (!listing.shippingCost) return null
  return (
    <div className="font-data mt-1 text-xs font-bold text-slate-700 dark:text-slate-300">
      ${knownTotal.toFixed(2)} with shipping, before tax
    </div>
  )
}

function FitmentBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="badge bg-emerald-100 text-emerald-800"><ShieldCheck size={12} /> Year, make &amp; model match</span>
  ) : (
    <span className="badge bg-amber-100 text-amber-800"><AlertTriangle size={12} /> Fit not confirmed</span>
  )
}

function ListingImage({ listing, className }: { listing: Listing; className: string }) {
  return listing.image ? (
    <img
      src={listing.image}
      alt={listing.title}
      loading="lazy"
      decoding="async"
      width={96}
      height={96}
      className={`${className} rounded-xl border border-slate-100 object-cover shadow-sm`}
    />
  ) : (
    <div className={`${className} flex items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500`}>
      <Package size={28} strokeWidth={1.25} />
    </div>
  )
}

function SellerRating({ listing, showCount = true }: { listing: Listing; showCount?: boolean }) {
  if (!listing.sellerFeedbackPercentage) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-amber-700 dark:text-amber-300">
      <Star size={13} className="fill-current" /> {listing.sellerFeedbackPercentage}%
      {showCount && listing.sellerFeedbackScore && <span className="text-slate-500">({listing.sellerFeedbackScore.toLocaleString()})</span>}
    </span>
  )
}

export function ListingCard(props: ListingCardProps) {
  const isMobile = useIsMobile()
  return isMobile ? <CompactListingCard {...props} /> : <FullListingCard {...props} />
}

function FullListingCard({
  listing,
  index,
  isBestValue,
  isCheapest,
  inWatchlist,
  isComparing,
  effectiveZip,
  onSelect,
  onAddToWatchlist,
  onToggleCompare,
  onOutboundClick,
}: ListingCardProps) {
  // Best Value explanation: hover-only tooltips don't exist on touch, so the
  // badge is also a tap-toggle. Desktop hover still works via group-hover.
  const [showValueInfo, setShowValueInfo] = useState(false)
  const titleId = useId()
  const isFitmentVerified = listing.verifiedFitment === true
  const showBestValue = isFitmentVerified && isBestValue
  const showCheapest = isFitmentVerified && isCheapest
  const knownTotal = knownTotalCost(listing)

  return (
    <li
      className={`listing-card group flex min-w-0 max-w-full flex-col gap-4 p-[16px] sm:flex-row sm:items-start sm:p-5 ${showBestValue ? 'ring-1 ring-brand-300/70' : ''}`}
    >
      {showBestValue && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 via-brand-600 to-brand-500" />
      )}

      <div className="relative shrink-0">
        <div className="font-data flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
          {String(index + 1).padStart(2, '0')}
        </div>
        <ListingImage listing={listing} className="mt-3 h-24 w-24" />
      </div>

      <div className="min-w-0 max-w-full flex-1 pt-1">
        <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2">
          {/* Wrap by the card's available width, not the viewport: the tablet
              sidebar leaves too little room for a title and total side by side. */}
          <div className="flex min-w-0 grow basis-48 flex-wrap items-center gap-2">
            <h3 id={titleId} className="break-anywhere min-w-0 text-[15px] font-semibold leading-tight tracking-[-0.1px] text-slate-950 group-hover:text-brand-700">
              {listing.title}
            </h3>
            {showBestValue && (
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-400 font-extrabold uppercase tracking-wider px-2 py-0.5 shrink-0">
                Best value estimate
              </span>
            )}
            {showCheapest && (
              <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 font-extrabold uppercase tracking-wider px-2 py-0.5 shrink-0">
                Lowest known total
              </span>
            )}
          </div>
          <div className="min-w-0 max-w-full shrink-0 text-left sm:ml-auto sm:text-right">
            {listing.originalPrice && (
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">↓ Price dropped</div>
            )}
            {listing.originalPrice && <div className="font-data text-xs text-slate-500 line-through">${listing.originalPrice.toFixed(2)}</div>}
            <div className="font-data font-semibold text-slate-950 text-[24px] leading-none">
              ${listing.price.toFixed(2)}
            </div>
            <TotalNote listing={listing} knownTotal={knownTotal} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="badge bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs">{listing.condition}</span>
          <span className="font-medium">{listing.seller} · {listing.source}</span>
          <SellerRating listing={listing} />
        </div>

        {listing.itemLocation && <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={13} /> {listing.itemLocation}</div>}

        {(shippingLabel(listing) || deliveryLabel(listing, effectiveZip)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium">
              <Truck size={13} className="text-slate-500" />
              {shippingLabel(listing) === 'Free shipping' ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">Free shipping</span> : shippingLabel(listing)}
            </span>
            {deliveryLabel(listing, effectiveZip) && <span className="text-slate-500">· {deliveryLabel(listing, effectiveZip)}</span>}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <FitmentBadge verified={isFitmentVerified} />
          {showBestValue && (
            <span className="group relative badge bg-emerald-100 text-emerald-800 p-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowValueInfo((v) => !v)
                }}
                aria-expanded={showValueInfo}
                aria-describedby={`bv-tip-${listing.id}`}
                aria-label="Explain this value estimate"
                className="inline-flex min-h-11 touch-manipulation items-center gap-1 px-2.5 py-1.5"
              >
                <Sparkles size={12} /> Value estimate among matched listings
              </button>
              <span
                id={`bv-tip-${listing.id}`}
                role="tooltip"
                className={`pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-normal leading-normal text-white shadow-xl transition-all duration-200 ${showValueInfo ? 'opacity-100' : 'opacity-0'} sm:group-hover:opacity-100`}
              >
                <strong>Value estimate:</strong> {VALUE_ESTIMATE_EXPLANATION}
                <span className="absolute top-full left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1 bg-slate-950 rotate-45" />
              </span>
            </span>
          )}
          {listing.topRatedSeller && <span className="badge bg-brand-100 text-brand-800"><Award size={12} /> Top Rated</span>}
          {listing.bestOfferAccepted && <span className="badge bg-slate-100 text-slate-700">Best Offer</span>}
          {listing.originalPrice && listing.discountPercentage && <span className="badge bg-rose-100 text-rose-700"><Tag size={12} /> {listing.discountPercentage}% off</span>}
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap gap-2">
          <OutboundLink href={listing.link} onClick={onOutboundClick} aria-describedby={titleId} className="btn btn-primary w-full min-w-0 whitespace-nowrap px-4 py-2 text-sm sm:w-auto sm:flex-none sm:px-5">
            View on {listing.source} <ExternalLink size={14} />
          </OutboundLink>
          <button
            type="button"
            onClick={() => onSelect(listing)}
            aria-describedby={titleId}
            className="btn btn-secondary px-5 py-2 text-sm"
          >
            Details
          </button>
          <button
            type="button"
            disabled={inWatchlist}
            onClick={() => onAddToWatchlist(listing)}
            aria-describedby={titleId}
            className={`btn px-5 py-2 text-sm ${inWatchlist ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'btn-secondary'}`}
          >
            {inWatchlist ? <><Check size={15} /> Watching</> : <><Plus size={15} /> Watch part</>}
          </button>
          <CompareToggle isComparing={isComparing} onToggle={() => onToggleCompare(listing)} titleId={titleId} className="px-4 py-2 text-sm" />
        </div>
      </div>
    </li>
  )
}

// One toggle per listing. The label stays "Compare" and aria-pressed carries
// the state, so screen readers say "Compare, toggle button, pressed".
function CompareToggle({ isComparing, onToggle, titleId, className = '' }: { isComparing: boolean; onToggle: () => void; titleId: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isComparing}
      aria-describedby={titleId}
      className={`btn ${isComparing ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300' : 'btn-ghost'} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-[18px] w-[18px] items-center justify-center rounded border ${isComparing ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-400'}`}
      >
        {isComparing && <Check size={12} strokeWidth={3} />}
      </span>
      Compare
    </button>
  )
}

// Phone layout: about half the height of the full card so several listings
// fit on a screen. The photo sits beside the title, the primary action gets
// its own full-width row, and the secondary actions share the last row.
function CompactListingCard({
  listing,
  isBestValue,
  isCheapest,
  inWatchlist,
  isComparing,
  effectiveZip,
  onSelect,
  onAddToWatchlist,
  onToggleCompare,
  onOutboundClick,
}: ListingCardProps) {
  const [showValueInfo, setShowValueInfo] = useState(false)
  const titleId = useId()
  const valueInfoId = useId()
  const isFitmentVerified = listing.verifiedFitment === true
  const showBestValue = isFitmentVerified && isBestValue
  const showCheapest = isFitmentVerified && isCheapest
  const knownTotal = knownTotalCost(listing)
  const shipping = shippingLabel(listing)
  const delivery = deliveryLabel(listing, effectiveZip)

  return (
    <li
      className={`listing-card grid min-w-0 max-w-full grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5 p-3 ${showBestValue ? 'ring-1 ring-brand-300/70' : ''}`}
    >
      {showBestValue && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-400 via-brand-600 to-brand-500" />
      )}

      <div className="row-span-3">
        <ListingImage listing={listing} className="h-[72px] w-[72px]" />
      </div>

      <h3 id={titleId} className="break-anywhere line-clamp-2 text-sm font-semibold leading-snug text-slate-950">
        {listing.title}
      </h3>

      <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
        <span className="shrink-0 font-semibold text-slate-700">{listing.condition}</span>
        <span className="min-w-0 flex-1 truncate">{listing.seller}</span>
        <SellerRating listing={listing} showCount={false} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-data text-xl font-semibold leading-none text-slate-950">${listing.price.toFixed(2)}</span>
          {shipping && (
            <span className="text-xs text-slate-600">
              {shipping === 'Free shipping' ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">Free shipping</span> : shipping}
            </span>
          )}
        </div>
        <TotalNote listing={listing} knownTotal={knownTotal} />
        {(delivery || listing.itemLocation) && (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <Truck size={12} className="shrink-0" />
            <span className="min-w-0 truncate">{[delivery, listing.itemLocation].filter(Boolean).join(' · ')}</span>
          </div>
        )}
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-1.5">
        <FitmentBadge verified={isFitmentVerified} />
        {showBestValue && (
          <button
            type="button"
            onClick={() => setShowValueInfo((v) => !v)}
            aria-expanded={showValueInfo}
            aria-controls={valueInfoId}
            className="badge min-h-11 touch-manipulation bg-brand-50 px-2.5 text-brand-700 dark:bg-brand-950/20 dark:text-brand-400"
          >
            <Sparkles size={12} /> Best value estimate
          </button>
        )}
        {showCheapest && <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">Lowest known total</span>}
        {listing.topRatedSeller && <span className="badge bg-brand-100 text-brand-800"><Award size={12} /> Top Rated</span>}
        {listing.originalPrice && listing.discountPercentage && <span className="badge bg-rose-100 text-rose-700"><Tag size={12} /> {listing.discountPercentage}% off</span>}
      </div>
      {showBestValue && showValueInfo && (
        <p id={valueInfoId} className="col-span-2 rounded-xl bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <strong>Value estimate:</strong> {VALUE_ESTIMATE_EXPLANATION}
        </p>
      )}

      <OutboundLink href={listing.link} onClick={onOutboundClick} aria-describedby={titleId} className="btn btn-primary col-span-2 w-full whitespace-nowrap px-4 py-2 text-sm">
        View on {listing.source} <ExternalLink size={14} />
      </OutboundLink>

      <div className="col-span-2 grid grid-cols-[1fr_1fr_auto] gap-1.5">
        <button type="button" onClick={() => onSelect(listing)} aria-describedby={titleId} className="btn btn-secondary px-2 text-sm">
          Details
        </button>
        <button
          type="button"
          disabled={inWatchlist}
          onClick={() => onAddToWatchlist(listing)}
          aria-describedby={titleId}
          className={`btn px-2 text-sm ${inWatchlist ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'btn-secondary'}`}
        >
          {inWatchlist ? <><Check size={15} /> Watching</> : <><Plus size={15} /> Watch</>}
        </button>
        <CompareToggle isComparing={isComparing} onToggle={() => onToggleCompare(listing)} titleId={titleId} className="whitespace-nowrap px-2 text-sm" />
      </div>
    </li>
  )
}
