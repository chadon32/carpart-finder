import { useState, Suspense, lazy } from 'react'
import { X, ExternalLink, Star, Truck, Award, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react'
import type { Listing } from '../api/client'
import type { Car } from './CarSelector'
import { Modal } from './Modal'
import { trackAddedToWatchlist, trackRetailerClick } from '../lib/analytics'
import { AffiliateDisclosure } from './AffiliateDisclosure'

// RepairGuideModal pulls in react-markdown (heavy) and only renders when the
// user clicks "Generate AI Guide" — load it (and its markdown deps) on demand.
const RepairGuideModal = lazy(() => import('./RepairGuideModal').then((m) => ({ default: m.RepairGuideModal })))

const fitmentScopeLabels = {
  'year-make-model': 'Year, make, and model',
  'year-make-model-trim': 'Year, make, model, and trim',
  'keyword-only': 'Keyword-only',
} as const

function formatCheckedAt(checkedAt: string) {
  const date = new Date(checkedAt)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
}

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
      {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="text-xs font-semibold tracking-[1px] text-brand-600">DETAILED VIEW</div>
            <div className="font-semibold text-xl tracking-tight text-slate-950">{part}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-5">
          {/* Image */}
          <div className="md:col-span-2">
            {listing.image ? (
              <img
                src={listing.image}
                alt={listing.title}
                loading="lazy"
                decoding="async"
                className="w-full rounded-2xl border border-slate-100 object-cover shadow-sm"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-300">
                No image
              </div>
            )}
          </div>

          {/* Details */}
          <div className="md:col-span-3">
            <h3 className="text-xl font-semibold leading-tight tracking-[-0.3px] text-slate-950">{listing.title}</h3>

            <div className="mt-4 flex items-baseline gap-3">
              {listing.originalPrice && (
                <span className="font-data text-lg text-slate-400 line-through">${listing.originalPrice.toFixed(2)}</span>
              )}
              <span className="font-data text-5xl font-semibold tracking-[-1px] text-slate-950">${listing.price.toFixed(2)}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="badge bg-slate-900 text-white px-3 py-1">{listing.condition}</span>
              {listing.topRatedSeller && <span className="badge bg-brand-100 text-brand-800"><Award size={13} /> Top Rated</span>}
              {listing.sellerFeedbackPercentage && (
                <span className="badge bg-amber-100 text-amber-800">
                  <Star size={13} className="fill-current" /> {listing.sellerFeedbackPercentage}%
                </span>
              )}
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <div><span className="font-medium text-slate-700">Seller:</span> {listing.seller} on {listing.source}</div>
              {listing.itemLocation && <div><span className="font-medium text-slate-700">Location:</span> {listing.itemLocation}</div>}
              {listing.shippingCost != null && (
                <div className="flex items-center gap-2">
                  <Truck size={15} className="text-slate-400" />
                  {listing.shippingCost === 0 ? (
                    <span className="font-semibold text-emerald-600">Free shipping</span>
                  ) : (
                    `+$${listing.shippingCost.toFixed(2)} shipping`
                  )}
                </div>
              )}
            </div>

            {listing.shortDescription && (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                {listing.shortDescription}
              </div>
            )}

            {!isFitmentVerified ? (
              <div className="mt-5 flex items-center gap-2 text-xs text-amber-700">
                <AlertTriangle size={14} /> Marketplace compatibility not confirmed for {vehicleLabel} — check before buying
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-2 text-xs text-emerald-700">
                <ShieldCheck size={14} /> Marketplace compatibility match for {vehicleLabel}
              </div>
            )}
            
            {listing.fitmentEvidence && (
              <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40">
                <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
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
                  {formatCheckedAt(listing.fitmentEvidence.checkedAt) && (
                    <>
                      <dt className="font-semibold">Checked</dt>
                      <dd>{formatCheckedAt(listing.fitmentEvidence.checkedAt)}</dd>
                    </>
                  )}
                </dl>
                <p className="mt-2 text-slate-500">
                  This marketplace compatibility match is not a fitment guarantee. Confirm engine, drivetrain, options, dimensions, and original part number on the retailer page before buying.
                </p>
              </details>
            )}

            {companions && companions.length > 0 && onSearchPart && (
              <div className="mt-5">
                <div className="eyebrow">Complete the job</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {companions.map((c) => (
                    <button key={c} type="button" onClick={() => onSearchPart(c)} className="btn btn-secondary px-3 py-1.5 text-xs">
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
                    <h4 className="font-bold text-slate-900 tracking-tight">Need help replacing this?</h4>
                  </div>
                  <p className="text-sm text-slate-600">
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

        {/* Footer Actions — pinned to the sheet bottom on mobile */}
        <div className="sticky bottom-0 mt-4 border-t bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:p-6">
          <AffiliateDisclosure className="mb-3" />
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

            <a
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
            </a>

            <button onClick={onClose} className="btn btn-ghost hidden py-3 text-base sm:inline-flex">
              Close
            </button>
          </div>
        </div>
    </Modal>
  )
}
