import { X, ExternalLink, Star, Award, Check, AlertTriangle } from 'lucide-react'
import type { Listing } from '../api/client'
import { Modal } from './Modal'

export function ComparisonModal({ listings, onClose }: { listings: Listing[]; onClose: () => void }) {
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
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <div className="text-xs font-semibold tracking-wider text-brand-500 uppercase">Comparison Matrix</div>
          <h3 className="text-base font-bold tracking-tight text-slate-900">Side-by-Side Part Comparison</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
        >
          <X size={18} />
        </button>
      </div>

      <div className="overflow-x-auto p-6">
        <table className="w-full min-w-[700px] border-collapse text-left text-xs text-slate-600">
          <thead>
            <tr>
              <th className="w-40 pb-4 pr-4 font-semibold text-slate-400 uppercase tracking-wider">Attribute</th>
              {listings.map((item) => (
                <th key={item.id} className="pb-4 px-4 align-top w-64 border-l border-slate-100/80">
                  <div className="flex flex-col gap-2">
                    <span className="badge w-max bg-slate-100 text-slate-800 font-semibold px-2 py-0.5">{item.source}</span>
                    <div className="line-clamp-2 text-xs font-bold text-slate-900 leading-snug min-h-[32px]">{item.title}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Price */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-slate-900">Retail Price</td>
              {listings.map((item) => (
                <td key={item.id} className="font-data py-4 px-4 font-bold text-sm text-slate-900 border-l border-slate-100/80">
                  ${item.price.toFixed(2)}
                </td>
              ))}
            </tr>

            {/* Shipping */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-slate-900">Shipping Cost</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-slate-100/80">
                  {item.shippingCost === 0 ? (
                    <span className="font-semibold text-emerald-600">Free shipping</span>
                  ) : item.shippingCost != null ? (
                    `+$${item.shippingCost.toFixed(2)}`
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Total Price */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-slate-900">Total Out-of-Pocket</td>
              {listings.map((item) => {
                const total = item.price + (item.shippingCost || 0)
                return (
                  <td key={item.id} className="font-data py-4 px-4 font-bold text-base text-slate-950 border-l border-slate-100/80">
                    ${total.toFixed(2)}
                  </td>
                )
              })}
            </tr>

            {/* Fitment */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-slate-900">Fitment Check</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-slate-100/80">
                  {item.verifiedFitment === false ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                      <AlertTriangle size={13} /> Unverified Fitment
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                      <Check size={13} strokeWidth={3} /> Verified Fitment
                    </span>
                  )}
                </td>
              ))}
            </tr>

            {/* Seller */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-slate-900">Seller & Rating</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-slate-100/80">
                  <div className="font-medium text-slate-800 truncate max-w-[220px]">{item.seller || 'Direct Partner'}</div>
                  {item.sellerFeedbackPercentage && (
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
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
              <td className="py-4 pr-4 font-semibold text-slate-900">Est. Delivery</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-slate-100/80 font-medium text-slate-700">
                  {getDeliveryText(item)}
                </td>
              ))}
            </tr>

            {/* Location */}
            <tr>
              <td className="py-4 pr-4 font-semibold text-slate-900">Ships From</td>
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-slate-100/80 text-slate-500">
                  {item.itemLocation || '—'}
                </td>
              ))}
            </tr>

            {/* Action Direct link */}
            <tr>
              <td className="py-4 pr-4" />
              {listings.map((item) => (
                <td key={item.id} className="py-4 px-4 border-l border-slate-100/80">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary w-full text-center py-2"
                  >
                    View Listing <ExternalLink size={12} />
                  </a>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
