import { Star, Award, Tag, Sparkles, MapPin, AlertTriangle, ExternalLink, Check, Plus, Package, Truck, ShieldCheck } from 'lucide-react'
import type { Listing } from '../api/client'
import { deliveryLabel, shippingLabel } from '../lib/listingHelpers'

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
}

export function ListingCard({
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
}: ListingCardProps) {
  return (
    <li
      onClick={(e) => {
        // Open the detail view unless an inner button/link was the target.
        if ((e.target as HTMLElement).closest('a,button')) return
        onSelect(listing)
      }}
      className={`listing-card group flex flex-col gap-4 p-5 sm:flex-row sm:items-start cursor-pointer ${isBestValue ? 'ring-1 ring-brand-300/70' : ''} ${listing.verifiedFitment === false ? 'ring-2 ring-amber-400 dark:ring-amber-500/50' : ''}`}
    >
      {isBestValue && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-teal-600" />
      )}

      <div className="relative shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
          {index + 1}
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
              <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-400 font-extrabold uppercase tracking-wider px-2 py-0.5 text-[9px] shrink-0">
                Best Value
              </span>
            )}
            {isCheapest && (
              <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 font-extrabold uppercase tracking-wider px-2 py-0.5 text-[9px] shrink-0">
                Cheapest Deal
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
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1">
              Total: ${(listing.price + (listing.shippingCost || 0)).toFixed(2)}
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

        {(shippingLabel(listing) || deliveryLabel(listing, effectiveZip)) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium">
              <Truck size={13} className="text-slate-400" />
              {shippingLabel(listing) === 'Free shipping' ? <span className="font-semibold text-emerald-600">Free shipping</span> : shippingLabel(listing)}
            </span>
            {deliveryLabel(listing, effectiveZip) && <span className="text-slate-500">· {deliveryLabel(listing, effectiveZip)}</span>}
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
            Buy on {listing.source} <ExternalLink size={14} />
          </a>
          <button
            type="button"
            onClick={() => onSelect(listing)}
            className="btn btn-secondary px-5 py-2 text-sm"
          >
            Click for Detailed View
          </button>
          <button
            type="button"
            disabled={inWatchlist}
            onClick={() => onAddToWatchlist(listing)}
            className={`btn px-5 py-2 text-sm ${inWatchlist ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'btn-secondary'}`}
          >
            {inWatchlist ? <><Check size={15} /> Watching</> : <><Plus size={15} /> Watch part</>}
          </button>
          <button
            onClick={() => onToggleCompare(listing)}
            className="btn btn-ghost px-4 py-2 text-sm"
          >
            {isComparing ? 'Remove' : 'Compare'}
          </button>
        </div>
      </div>
    </li>
  )
}
