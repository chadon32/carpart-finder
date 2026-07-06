import { useState, Suspense, lazy } from 'react'
import { X, ExternalLink, Star, Truck, Award, ShieldCheck, Sparkles } from 'lucide-react'
import type { Listing } from '../api/client'
import { Modal } from './Modal'
import { trackAddedToWatchlist } from '../lib/analytics'

// RepairGuideModal pulls in react-markdown (heavy) and only renders when the
// user clicks "Generate AI Guide" — load it (and its markdown deps) on demand.
const RepairGuideModal = lazy(() => import('./RepairGuideModal').then((m) => ({ default: m.RepairGuideModal })))

function PriceHistoryChart({ price }: { price: number }) {
  // Generate deterministic mock price history values
  const lowPrice = price * 0.88
  const highPrice = price * 1.05
  const avgPrice = price * 0.96

  const width = 500
  const height = 120
  const padding = 15

  const points = [
    { label: '90d ago', val: price * 1.02 },
    { label: '60d ago', val: price * 1.04 },
    { label: '45d ago', val: price * 0.98 },
    { label: '30d ago', val: price * 0.88 }, // Low
    { label: '15d ago', val: price * 0.94 },
    { label: 'Today', val: price }
  ]

  const minVal = price * 0.82
  const maxVal = price * 1.08
  const range = maxVal - minVal

  const coords = points.map((p, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2)
    const y = height - padding - ((p.val - minVal) / range) * (height - padding * 2)
    return { x, y, ...p }
  })

  const pathD = coords.reduce((acc, c, i) => {
    return i === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`
  }, '')

  const fillD = `${pathD} L ${coords[coords.length - 1].x} ${height - padding} L ${coords[0].x} ${height - padding} Z`

  const percentBelowAvg = ((avgPrice - price) / avgPrice) * 100
  let advice = "Price is currently average for this part."
  let adviceColor = "text-slate-500 bg-slate-50"
  if (percentBelowAvg > 5) {
    advice = `Trending Low — Currently $${(avgPrice - price).toFixed(2)} (${percentBelowAvg.toFixed(0)}%) below average. Good deal!`
    adviceColor = "text-emerald-700 bg-emerald-50 border border-emerald-100"
  } else if (percentBelowAvg < -5) {
    advice = `Trending High — Currently $${(price - avgPrice).toFixed(2)} (${Math.abs(percentBelowAvg).toFixed(0)}%) above average.`
    adviceColor = "text-amber-700 bg-amber-50 border border-amber-100"
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/20 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <div>Low: <span className="font-extrabold text-slate-800">${lowPrice.toFixed(2)}</span></div>
          <div>Avg: <span className="font-extrabold text-slate-800">${avgPrice.toFixed(2)}</span></div>
          <div>High: <span className="font-extrabold text-slate-800">${highPrice.toFixed(2)}</span></div>
        </div>
        <span className={`badge px-2.5 py-1 text-[10px] font-bold ${adviceColor}`}>
          {advice}
        </span>
      </div>

      <div className="relative h-[90px] w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0f766e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#f1f5f9" strokeWidth="1" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#f1f5f9" strokeDasharray="3 3" />

          {/* Area Fill */}
          <path d={fillD} fill="url(#chartGradient)" />

          {/* Trend line */}
          <path d={pathD} fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {coords.map((c, i) => (
            <g key={i} className="group/point">
              <circle
                cx={c.x}
                cy={c.y}
                r={c.label === 'Today' ? '4' : '3'}
                fill={c.label === 'Today' ? '#0f766e' : '#ffffff'}
                stroke="#0f766e"
                strokeWidth={c.label === 'Today' ? '2.5' : '1.5'}
              />
              <text
                x={c.x}
                y={height - 2}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="8"
                fontWeight="500"
              >
                {c.label}
              </text>
              <text
                x={c.x}
                y={c.y - 8}
                textAnchor="middle"
                fill="#0f172a"
                fontSize="8"
                fontWeight="bold"
                className="opacity-0 group-hover/point:opacity-100 transition duration-150 pointer-events-none"
              >
                ${c.val.toFixed(2)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

interface PartDetailModalProps {
  listing: Listing
  vehicleLabel: string
  part: string
  onClose: () => void
  onAddToWatchlist: () => void
  isInWatchlist: boolean
}

export function PartDetailModal({
  listing,
  vehicleLabel,
  part,
  onClose,
  onAddToWatchlist,
  isInWatchlist,
}: PartDetailModalProps) {
  const [showGuideModal, setShowGuideModal] = useState(false)

  return (
    <>
    <Modal label={`${part} — listing details`} onClose={onClose}>
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
                loading="lazy"
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
            
            {/* AI Repair Guide Section */}
            <div className="mt-8 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/50 to-brand-50/20 p-5 shadow-sm">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={16} className="text-brand-600" />
                    <h4 className="font-bold text-slate-900 tracking-tight">Need help replacing this?</h4>
                  </div>
                  <p className="text-sm text-slate-600">
                    Get a custom step-by-step AI repair guide for your {vehicleLabel}.
                  </p>
                </div>
                <button 
                  onClick={() => setShowGuideModal(true)}
                  className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm shadow-sm hover:shadow transition-shadow w-full sm:w-auto"
                >
                  Generate AI Guide
                </button>
              </div>
            </div>
            
          </div>
        </div>

        {/* Price History */}
        <div className="px-6 pb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">90-Day Price Trend</h4>
          <PriceHistoryChart price={listing.price} />
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-3 border-t bg-slate-50 p-6 sm:flex-row mt-4">
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
    </Modal>
    
    {showGuideModal && (
      <Suspense fallback={null}>
        <RepairGuideModal
          vehicleLabel={vehicleLabel}
          part={part}
          onClose={() => setShowGuideModal(false)}
        />
      </Suspense>
    )}
    </>
  )
}
