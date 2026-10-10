import { useState, Suspense } from 'react'
import { X, ExternalLink, Star, Truck, Award, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react'
import type { Listing } from '../api/client'
import type { Car } from './CarSelector'
import { Modal } from './Modal'
import { trackAddedToWatchlist, trackRetailerClick } from '../lib/analytics'
import { AffiliateDisclosure } from './AffiliateDisclosure'
import { OutboundLink } from './OutboundLink'
import { lazyWithRecovery } from '../lib/lazyWithRecovery'
import { comparisonFitmentCheckedTimestamp, comparisonListingFreshnessLabel } from '../lib/comparisonShare'

// RepairGuideModal pulls in react-markdown (heavy) and only renders when the
// user clicks "Generate AI Guide" — load it (and its markdown deps) on demand.
const RepairGuideModal = lazyWithRecovery(() => import('./RepairGuideModal').then((m) => ({ default: m.RepairGuideModal })))

const fitmentScopeLabels = {
  'year-make-model': 'Year, make, and model',
  'year-make-model-trim': 'Year, make, model, and trim',
  'keyword-only': 'Keyword-only',
} as const

interface PartDetailModalProps {
  listing: Listing
  vehicle: Car
  vehicleLabel: string
  part: string
  companions?: string[]
  onSearchPart?: (part: string) => void
  onClose: () => void
  onAddToWatchlist: () => void
  isInWatchlist: boolean
}

export function PartDetailModal({
  listing,
  vehicle,
  vehicleLabel,
  part,
  companions,
  onSearchPart,
  onClose,
  onAddToWatchlist,
  isInWatchlist,
}: PartDetailModalProps) {
  const isFitmentVerified = listing.verifiedFitment === true
  const canGenerateGuide = isFitmentVerified && Boolean(listing.fitmentProof)
  const [showGuideModal, setShowGuideModal] = useState(false)

  if (showGuideModal) {
    return (
      <Suspense fallback={null}>
        <RepairGuideModal
          vehicle={vehicle}
          listing={listing}
          part={part}
          onClose={() => setShowGuideModal(false)}
        />
      </Suspense>
    )
  }

  return (
    <Modal label={`${part} — listing details`} onClose={onClose}>
      {/* Header — pinned so Close stays reachable while the details scroll */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-surface px-6 py-4">
          <div>
            <div className="font-semibold text-xl tracking-tight text-ink">{part}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex min-h-11 min-w-11 items-center justify-center rounded-full p-2.5 text-ink-5 hover:bg-surface-3 hover:text-ink-3">
            <X size={20} />
          </button>
        </div>

        {/* The listing's title, price, and fit status come first, then the
            photo, then everything else: on a phone the sheet used to open on a
            full-width photo with the price below the fold. */}
        <div className="grid gap-x-6 gap-y-4 p-4 sm:p-6 md:grid-cols-5">
          <div className="md:col-span-3 md:col-start-3 md:row-start-1">
            <h3 className="text-lg font-semibold leading-tight tracking-[-0.3px] text-ink sm:text-xl">{listing.title}</h3>

            <div className="mt-3 flex items-baseline gap-3">
              {listing.originalPrice && (
                <span className="font-data text-lg text-ink-4 line-through">${listing.originalPrice.toFixed(2)}</span>
              )}
              <span className="font-data text-4xl font-semibold tracking-[-1px] text-ink sm:text-5xl">${listing.price.toFixed(2)}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {isFitmentVerified ? (
                <span className="badge badge-fit"><ShieldCheck size={13} /> Year, make &amp; model match</span>
              ) : (
                <span className="badge badge-caution"><AlertTriangle size={13} /> Fit not confirmed</span>
              )}
              <span className="badge badge-fact px-3 py-1">{listing.condition}</span>
              {listing.topRatedSeller && <span className="badge badge-fact"><Award size={13} /> Top Rated</span>}
              {listing.sellerFeedbackPercentage && (
                <span className="badge badge-fact">
                  <Star size={13} className="fill-current text-amber-500" /> {listing.sellerFeedbackPercentage}%
                </span>
              )}
            </div>
          </div>

          {/* Image */}
          <div className="md:col-span-2 md:col-start-1 md:row-span-2 md:row-start-1">
            {listing.image ? (
              <img
                src={listing.image}
                alt={listing.title}
                loading="lazy"
                decoding="async"
                className="mx-auto w-40 rounded-2xl border border-line-soft object-cover shadow-sm sm:w-56 md:w-full"
              />
            ) : (
              <div className="mx-auto flex aspect-square w-40 items-center justify-center rounded-2xl border border-line-soft bg-surface-2 text-ink-4 sm:w-56 md:w-full">
                No image
              </div>
            )}
          </div>

          {/* Details */}
          <div className="md:col-span-3 md:col-start-3">
            <div className="space-y-2 text-sm text-ink-3">
              <div><span className="font-medium text-ink-2">Seller:</span> {listing.seller} on {listing.source}</div>
              {listing.itemLocation && <div><span className="font-medium text-ink-2">Location:</span> {listing.itemLocation}</div>}
              {listing.shippingCost != null && (
                <div className="flex items-center gap-2">
                  <Truck size={15} className="text-ink-5" />
                  {listing.shippingCost === 0 ? (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Free shipping</span>
                  ) : (
                    `+$${listing.shippingCost.toFixed(2)} shipping`
                  )}
                </div>
              )}
            </div>

            {listing.shortDescription && (
              <div className="mt-5 rounded-2xl bg-surface-2 p-4 text-sm leading-relaxed text-ink-3">
                {listing.shortDescription}
              </div>
            )}

            {!isFitmentVerified ? (
              <div className="mt-5 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle size={14} /> Fit not confirmed for your {vehicleLabel}. Check the part number before buying.
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                <ShieldCheck size={14} /> eBay lists your {vehicleLabel} as compatible. That is a year, make, and model match, not a fitment guarantee, so confirm trim, engine, and options before buying.
              </div>
            )}
            
            {listing.fitmentEvidence && (
              <details className="mt-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs text-ink-3 dark:border-slate-800">
                <summary className="cursor-pointer font-semibold text-ink">
                  Why this marketplace compatibility label?
                </summary>
                <p className="mt-2 leading-relaxed">{listing.fitmentEvidence.note}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="font-semibold">Scope</dt>
                  <dd>{fitmentScopeLabels[listing.fitmentEvidence.scope]}</dd>
                  {listing.fitmentEvidence.provider && (
                    <>
                      <dt className="font-semibold">Provider</dt>
                      <dd>{listing.fitmentEvidence.provider}</dd>
                    </>
                  )}
                  {listing.fitmentEvidence.matchedVehicle && (
                    <>
                      <dt className="font-semibold">Matched fields</dt>
                      <dd>
                        {listing.fitmentEvidence.matchedVehicle.year}{' '}
                        {listing.fitmentEvidence.matchedVehicle.make}{' '}
                        {listing.fitmentEvidence.matchedVehicle.model}
                        {listing.fitmentEvidence.matchedVehicle.trim
                          ? ` ${listing.fitmentEvidence.matchedVehicle.trim}`
                          : ''}
                      </dd>
                    </>
                  )}
                  <dt className="font-semibold">Evidence</dt>
                  <dd>{listing.fitmentEvidence.matchType || 'No structured compatibility match'}</dd>
                  <dt className="font-semibold">Fitment evidence checked</dt>
                  <dd>{comparisonFitmentCheckedTimestamp(listing)}</dd>
                  <dt className="font-semibold">Listing freshness</dt>
                  <dd>{comparisonListingFreshnessLabel(listing)}</dd>
                </dl>
                <p className="mt-2 text-ink-4">
                  This marketplace compatibility match is not a fitment guarantee. Confirm engine, drivetrain, options, dimensions, and original part number on the retailer page before buying.
                </p>
              </details>
            )}

            {companions && companions.length > 0 && onSearchPart && (
              <div className="mt-5">
                <div className="eyebrow">Complete the job</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {companions.map((c) => (
                    <button key={c} type="button" onClick={() => onSearchPart(c)} className="btn btn-secondary px-3 py-1.5">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI Repair Guide Section */}
            <div className="mt-8 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/50 to-brand-50/20 p-5 shadow-sm">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={16} className="text-brand-600" />
                    <h4 className="font-bold text-ink tracking-tight">Need help replacing this?</h4>
                  </div>
                  <p className="text-sm text-ink-3">
                    {canGenerateGuide
                      ? `Get a cautious step-by-step AI repair overview for your ${vehicleLabel}.`
                      : 'Repair guidance is available only after the marketplace confirms compatibility for the selected vehicle.'}
                  </p>
                </div>
                {canGenerateGuide && (
                  <button
                    onClick={() => setShowGuideModal(true)}
                    className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm shadow-sm hover:shadow transition-shadow w-full sm:w-auto"
                  >
                    Generate AI Guide
                  </button>
                )}
              </div>
            </div>
            
          </div>
        </div>

        {/* Footer actions — pinned to the bottom on every screen size so the
            retailer link never sits below the fold of a long listing */}
        <div className="sticky bottom-0 z-10 mt-4 border-t bg-surface-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <AffiliateDisclosure compact className="mb-3" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                onAddToWatchlist()
                trackAddedToWatchlist(part, listing.price, listing.source)
              }}
              disabled={isInWatchlist}
              className={`btn flex-1 py-3 text-base ${isInWatchlist ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'btn-secondary'}`}
            >
              {isInWatchlist ? 'Added to Watchlist' : 'Add to Watchlist'}
            </button>

            <OutboundLink
              href={listing.link}
              onClick={() => trackRetailerClick({
                retailer: listing.source,
                placement: 'listing-detail',
                vehicleLabel,
                part,
                listingId: listing.id,
                fitmentStatus: listing.verifiedFitment === true ? 'verified' : 'unverified',
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary flex-1 py-3 text-base"
            >
              View on {listing.source} <ExternalLink size={16} />
            </OutboundLink>

            <button onClick={onClose} className="btn btn-ghost hidden py-3 text-base sm:inline-flex">
              Close
            </button>
          </div>
        </div>
    </Modal>
  )
}
