import { X, ExternalLink, Star, Award, Check, AlertTriangle } from 'lucide-react'
import type { Listing } from '../api/client'
import type { Car } from './CarSelector'
import { Modal } from './Modal'
import { OutboundLink } from './OutboundLink'
import { knownTotalCost } from '../lib/listingHelpers'
import { ComparisonShareCard } from './ComparisonShareCard'
import { comparisonListingFreshnessLabel } from '../lib/comparisonShare'

const fitmentScopeLabels = {
  'year-make-model': 'Year, make, and model',
  'year-make-model-trim': 'Year, make, model, and trim',
  'keyword-only': 'Keyword-only',
} as const

function formatCheckedAt(checkedAt: string) {
  const date = new Date(checkedAt)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
}

export function ComparisonModal({ listings, vehicle, part, onClose }: { listings: Listing[]; vehicle: Car; part: string; onClose: () => void }) {
  const getDeliveryText = (item: Listing) => {
    if (!item.deliveryMin && !item.deliveryMax) return '—'
    const min = item.deliveryMin ? new Date(item.deliveryMin) : null
    const max = item.deliveryMax ? new Date(item.deliveryMax) : null
    const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    try {
      if (min && max && min.toDateString() !== max.toDateString()) {
        return `${dateFmt.format(min)} – ${dateFmt.format(max)}`
      }
      const d = max || min
      return d ? dateFmt.format(d) : '—'
    } catch {
      return '—'
    }
  }

  return (
    <Modal label="Compare listings" onClose={onClose} maxWidth="max-w-5xl">
      <div className="flex items-center justify-between border-b border-line-soft px-6 py-4">
        <div>
          <h3 className="text-base font-bold tracking-tight text-ink">Side-by-Side Part Comparison</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-2 text-ink-5 hover:bg-surface-2 hover:text-ink-2 transition"
        >
          <X size={18} />
        </button>
      </div>

      <p className="px-6 pt-4 text-sm text-ink-4 sm:hidden">Swipe sideways to compare every selected listing.</p>
      <div className="overflow-x-auto p-6" tabIndex={0} aria-label="Scrollable listing comparison table">
        <table className="w-full min-w-[700px] border-collapse text-left text-xs text-ink-3">
          <thead>
            <tr>
              <th className="w-40 pb-4 pr-4 font-semibold text-ink-4">Attribute</th>
              {listings.map((item) => (
                <th key={item.id} className="pb-4 px-4 align-top w-64 border-l border-line-soft/80">
                  <div className="flex flex-col gap-2">
                    <span className="badge w-max bg-surface-3 text-ink font-semibold px-2 py-0.5">{item.source}</span>
                    <div className="line-clamp-2 text-xs font-bold text-ink leading-snug min-h-[32px]">{item.title}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {/* Price */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-ink">Retail Price</td>
              {listings.map((item) => (
                <td key={item.id} className="font-data py-4 px-4 font-bold text-sm text-ink border-l border-line-soft/80">
                  ${item.price.toFixed(2)}
                </td>
              ))}
            </tr>

            {/* Shipping */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-ink">Shipping Cost</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-line-soft/80">
                  {item.shippingCost === 0 ? (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Free shipping</span>
                  ) : item.shippingCost != null ? (
                    `+$${item.shippingCost.toFixed(2)}`
                  ) : (
                    <span className="text-ink-4">Shown at checkout</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Total Price */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-ink">Item + known shipping (before tax)</td>
              {listings.map((item) => {
                const total = knownTotalCost(item)
                return (
                  <td key={item.id} className="font-data py-4 px-4 font-bold text-base text-ink border-l border-line-soft/80">
                    {total == null ? 'Total unavailable' : `$${total.toFixed(2)}`}
                  </td>
                )
              })}
            </tr>

            {/* Fitment */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-ink">Marketplace compatibility</td>
              {listings.map((item) => {
                const evidence = item.fitmentEvidence
                const checkedAt = evidence ? formatCheckedAt(evidence.checkedAt) : null

                return (
                  <td key={item.id} className="py-4 px-4 border-l border-line-soft/80">
                    {item.verifiedFitment !== true ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                        <AlertTriangle size={13} /> Marketplace compatibility not confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                        <Check size={13} strokeWidth={3} /> Marketplace compatibility match
                      </span>
                    )}
                    {evidence && (
                      <div className="mt-2 space-y-1 text-xs leading-relaxed text-ink-4">
                        <div><span className="font-semibold text-ink-3">Scope:</span> {fitmentScopeLabels[evidence.scope]}</div>
                        {evidence.provider && <div><span className="font-semibold text-ink-3">Provider:</span> {evidence.provider}</div>}
                        <div><span className="font-semibold text-ink-3">Fitment evidence checked:</span> {checkedAt || 'Unavailable'}</div>
                        <div><span className="font-semibold text-ink-3">Listing freshness:</span> {comparisonListingFreshnessLabel(item)}</div>
                        {evidence.note && <p>{evidence.note}</p>}
                        <p className="text-ink-4">Marketplace data can omit engine, drivetrain, options, and part-number details. Confirm before buying.</p>
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>

            {/* Seller */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-ink">Seller & Rating</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-line-soft/80">
                  <div className="font-medium text-ink truncate max-w-[220px]">{item.seller || 'Direct Partner'}</div>
                  {item.sellerFeedbackPercentage && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-4">
                      <Star size={10} className="fill-amber-400 text-amber-400" />
                      <span>{item.sellerFeedbackPercentage}% feedback</span>
                      {item.topRatedSeller && <Award size={10} className="text-brand-500" />}
                    </div>
                  )}
                </td>
              ))}
            </tr>

            {/* Delivery Date */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-ink">Est. Delivery</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-line-soft/80 font-medium text-ink-2">
                  {getDeliveryText(item)}
                </td>
              ))}
            </tr>

            {/* Location */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-ink">Ships From</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-line-soft/80 text-ink-4">
                  {item.itemLocation || '—'}
                </td>
              ))}
            </tr>

            {/* Action Direct link */}
            <tr>
              <td className="py-4 pr-4" />
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-line-soft/80">
                  <OutboundLink
                    href={item.link}
                    className="btn btn-primary w-full text-center py-2"
                  >
                    View Listing <ExternalLink size={12} />
                  </OutboundLink>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {/* The table answers the question first; sharing it comes after. */}
      <ComparisonShareCard listings={listings} vehicle={vehicle} part={part} />
    </Modal>
  )
}
