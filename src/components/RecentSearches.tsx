import { Clock, ArrowRight } from 'lucide-react'
import type { RecentSearch } from '../hooks/useRecentSearches'

export function RecentSearches({
  searches,
  onPick,
  onClear,
}: {
  searches: RecentSearch[]
  onPick: (search: RecentSearch) => void
  onClear: () => void
}) {
  if (searches.length === 0) return null

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
          className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-slate-200"
        >
          Clear all
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {searches.map((s) => (
          <button
            key={`${s.car.year}-${s.car.make}-${s.car.model}-${s.car.trim}-${s.part}-${s.at}`}
            type="button"
            onClick={() => onPick(s)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-500 hover:bg-brand-50/30 dark:hover:bg-brand-950/10 hover:shadow"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{s.part}</span>
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
        ))}
      </div>
    </div>
  )
}
