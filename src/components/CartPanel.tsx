import { useState, type ReactNode } from 'react'
import {
  Bookmark,
  ChevronLeft,
  RefreshCw,
  Columns3,
  List,
  ExternalLink,
  Trash2,
  TrendingDown,
  TrendingUp,
  Award,
} from 'lucide-react'
import type { CartItem } from '../hooks/useCart'
import { fetchPrices, type PriceInfo } from '../api/client'

type PriceCheck = Record<string, PriceInfo>

function PriceDropNote({ saved, info }: { saved: number; info: PriceInfo | undefined }) {
  if (!info) return null
  if (!info.available) {
    return <span className="text-xs font-semibold text-red-600">No longer available</span>
  }
  if (info.price == null) return null
  const diff = saved - info.price
  if (diff > 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
        <TrendingDown size={13} /> ${diff.toFixed(2)} cheaper — now ${info.price.toFixed(2)}
      </span>
    )
  }
  if (diff < -0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
        <TrendingUp size={13} /> ${Math.abs(diff).toFixed(2)} higher — now ${info.price.toFixed(2)}
      </span>
    )
  }
  return <span className="text-xs text-slate-400">Price unchanged</span>
}

function CompareTable({ items }: { items: CartItem[] }) {
  const rows: { label: string; render: (item: CartItem) => ReactNode }[] = [
    { label: 'Price', render: (i) => <span className="text-lg font-extrabold text-slate-900">${i.price.toFixed(2)}</span> },
    { label: 'Fits', render: (i) => i.carLabel },
    { label: 'Part', render: (i) => i.part },
    { label: 'Condition', render: (i) => i.condition },
    {
      label: 'Seller',
      render: (i) => (
        <span className="inline-flex items-center gap-1">
          {i.seller}
          {i.sellerFeedbackPercentage ? ` · ${i.sellerFeedbackPercentage}%` : ''}
          {i.topRatedSeller && <Award size={12} className="text-brand-600" />}
        </span>
      ),
    },
    { label: 'Ships from', render: (i) => i.itemLocation ?? '—' },
    { label: 'Source', render: (i) => i.source },
  ]

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-24 border-b border-slate-200 p-2" />
            {items.map((item) => (
              <th key={item.cartId} className="min-w-[190px] border-b border-slate-200 p-3 align-top">
                {item.image && <img src={item.image} alt="" className="mx-auto h-20 w-20 rounded-xl object-cover" />}
                <p className="mt-2 line-clamp-3 text-left text-xs font-semibold text-slate-900">{item.title}</p>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="align-top">
              <td className="border-b border-slate-100 p-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                {row.label}
              </td>
              {items.map((item) => (
                <td key={item.cartId} className="border-b border-slate-100 p-3 text-slate-700">
                  {row.render(item)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="p-3" />
            {items.map((item) => (
              <td key={item.cartId} className="p-3">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary px-3 py-1.5 text-xs"
                >
                  Buy on {item.source} <ExternalLink size={13} />
                </a>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function CartPanel({
  items,
  onRemove,
  onClear,
  onClose,
}: {
  items: CartItem[]
  onRemove: (cartId: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const [compare, setCompare] = useState(false)
  const [prices, setPrices] = useState<PriceCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const total = items.reduce((sum, item) => sum + item.price, 0)

  const checkPrices = () => {
    setChecking(true)
    setCheckError(null)
    fetchPrices(items.map((i) => i.id))
      .then((res) => setPrices(res.prices))
      .catch((err) => setCheckError(err.message))
      .finally(() => setChecking(false))
  }

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Bookmark size={18} strokeWidth={2.2} />
          </span>
          Compare Watchlist
          {items.length > 0 && <span className="text-sm font-medium text-slate-400">({items.length})</span>}
        </h2>
        <div className="flex items-center gap-1">
          {items.length > 1 && (
            <button type="button" onClick={() => setCompare((c) => !c)} className="btn btn-ghost px-2.5 py-1.5">
              {compare ? <List size={15} /> : <Columns3 size={15} />}
              {compare ? 'List' : 'Compare'}
            </button>
          )}
          {items.length > 0 && (
            <button type="button" onClick={checkPrices} disabled={checking} className="btn btn-ghost px-2.5 py-1.5">
              <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Checking…' : 'Check prices'}
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-ghost px-2.5 py-1.5">
            <ChevronLeft size={15} /> Search
          </button>
        </div>
      </div>

      {checkError && <p className="mt-3 text-sm text-red-600">Couldn't check prices: {checkError}</p>}
      {prices && !checkError && (
        <p className="mt-3 text-xs text-slate-400">Re-checked against live listings just now.</p>
      )}

      {items.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
          <Bookmark className="text-slate-300" size={32} />
          <p className="mt-3 font-semibold text-slate-700">Your Watchlist is empty</p>
          <p className="mt-1 text-sm text-slate-500 mb-4">Add parts from your search results to compare and check for price drops.</p>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary"
          >
            Start Searching Parts
          </button>
        </div>
      ) : compare ? (
        <CompareTable items={items} />
      ) : (
        <>
          <ul className="mt-6 flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.cartId}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 p-3 transition hover:border-slate-300"
              >
                {item.image && <img src={item.image} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {item.carLabel} · {item.part} · {item.source}
                  </p>
                  <div className="mt-1">
                    <PriceDropNote saved={item.price} info={prices?.[item.id]} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-lg font-extrabold text-slate-900">${item.price.toFixed(2)}</span>
                  <div className="flex gap-1.5">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary px-3 py-1.5 text-xs"
                    >
                      Buy on {item.source} <ExternalLink size={13} />
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemove(item.cartId)}
                      className="btn btn-secondary px-2.5 py-1.5 text-xs hover:border-red-300 hover:text-red-600"
                      aria-label="Remove from Watchlist"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
            <div>
              <p className="text-xs text-slate-500">
                {items.length} item{items.length === 1 ? '' : 's'} · bought directly from each seller
              </p>
              <p className="text-xl font-extrabold text-slate-900">Total of watched items: ${total.toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-semibold text-slate-500 transition hover:text-red-600"
            >
              Clear Watchlist
            </button>
          </div>
        </>
      )}
    </div>
  )
}
