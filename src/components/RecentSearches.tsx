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
  if (searches.length === 0) {
    return (
      <div className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
          <Clock size={15} className="text-slate-400" />
          Recent searches
        </div>
        <p className="text-xs text-slate-500">Search for a part and it will appear here for quick access.</p>
      </div>
    )
  }

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
          <Clock size={15} className="text-slate-400" />
          Recent searches
        </div>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200 sm:min-h-0"
        >
          Clear all
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {searches.map((s) => (
          <div
            key={`${s.car.year}-${s.car.make}-${s.car.model}-${s.car.trim}-${s.part}-${s.at}`}
            className="group flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pl-4 shadow-sm transition hover:border-brand-500 hover:bg-brand-50/30 hover:shadow dark:hover:bg-brand-950/10"
          >
            <button
              type="button"
              onClick={() => onPick(s)}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 py-1.5 text-left"
            >
              <span className="min-w-0">
                <span className="break-anywhere line-clamp-2 block text-sm font-semibold text-slate-900">{s.part}</span>
                <span className="block truncate text-xs text-slate-500">
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
              className="btn btn-ghost min-w-11 shrink-0 p-2 text-slate-400 hover:text-rose-600"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
