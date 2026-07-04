import React from 'react'
import { X, ExternalLink, Star, Truck, Award, ShieldCheck } from 'lucide-react'
import type { Listing } from '../api/client'

interface PartDetailModalProps {
  listing: Listing
  vehicleLabel: string
  part: string
  onClose: () => void
  onAddToCart: () => void
  isInCart: boolean
}

export function PartDetailModal({
  listing,
  vehicleLabel,
  part,
  onClose,
  onAddToCart,
  isInCart,
}: PartDetailModalProps) {
  // Close on Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl animate-slide-up overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="text-xs font-semibold tracking-[1px] text-brand-600">DETAILED VIEW</div>
            <div className="font-semibold text-xl tracking-tight text-slate-950">{part}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
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
                <span className="text-lg text-slate-400 line-through">${listing.originalPrice.toFixed(2)}</span>
              )}
              <span className="text-5xl font-semibold tracking-[-1px] text-slate-950">${listing.price.toFixed(2)}</span>
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

            {listing.verifiedFitment === false ? (
              <div className="mt-5 flex items-center gap-2 text-xs text-amber-700">
                <ShieldCheck size={14} /> Fitment for {vehicleLabel} not verified — check before buying
              </div>
            ) : (
              <div className="mt-5 flex items-center gap-2 text-xs text-emerald-700">
                <ShieldCheck size={14} /> Verified to fit {vehicleLabel}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-3 border-t bg-slate-50 p-6 sm:flex-row">
          <button
            onClick={onAddToCart}
            disabled={isInCart}
            className={`btn flex-1 py-3 text-base ${isInCart ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'btn-secondary'}`}
          >
            {isInCart ? 'Added to Cart' : 'Add to Cart'}
          </button>

          <a
            href={listing.link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary flex-1 py-3 text-base"
          >
            View on {listing.source} <ExternalLink size={16} />
          </a>

          <button onClick={onClose} className="btn btn-ghost py-3 text-base">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
