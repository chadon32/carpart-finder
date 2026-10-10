import { Clock, ArrowRight, X } from 'lucide-react'
import type { RecentSearch } from '../hooks/useRecentSearches'

export function RecentSearches({
  searches,
  onPick,
  onClear,
  onRemove,
}: {
  searches: RecentSearch[]
  onPick: (search: RecentSearch) => void
  onClear: () => void
  onRemove: (search: RecentSearch) => void
}) {
  // Nothing to show a first-time visitor; the section appears after a search.
  if (searches.length === 0) return null

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink-3">
          <Clock size={15} className="text-ink-5" />
          Recent searches
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-ink-4 transition-colors hover:text-ink dark:hover:text-slate-200 sm:min-h-0"
        >
          Clear all
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {searches.map((s) => (
          <div
            key={`${s.car.year}-${s.car.make}-${s.car.model}-${s.car.trim}-${s.part}-${s.at}`}
            className="group flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface p-1.5 pl-4 shadow-sm transition hover:border-brand-500 hover:bg-brand-50/30 hover:shadow dark:hover:bg-brand-950/10"
          >
            <button
              type="button"
              onClick={() => onPick(s)}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 py-1.5 text-left"
            >
              <span className="min-w-0">
                <span className="break-anywhere line-clamp-2 block text-sm font-semibold text-ink">{s.part}</span>
                <span className="block truncate text-xs text-ink-4">
                  {s.car.year} {s.car.make} {s.car.model}
                  {s.car.trim ? ` ${s.car.trim}` : ''}
                </span>
              </span>
              <ArrowRight
                size={16}
                className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
              />
            </button>
            <button
              type="button"
              onClick={() => onRemove(s)}
              aria-label={`Remove ${s.part} from recent searches`}
              className="btn btn-ghost min-w-11 shrink-0 p-2 text-ink-5 hover:text-rose-600"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
