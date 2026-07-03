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
    <div className="card mt-5 p-6 sm:p-7">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Clock size={16} className="text-slate-400" /> Recent searches
        </h2>
        <button type="button" onClick={onClear} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
          Clear
        </button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {searches.map((s) => (
          <button
            key={`${s.car.year}-${s.car.make}-${s.car.model}-${s.car.trim}-${s.part}-${s.at}`}
            type="button"
            onClick={() => onPick(s)}
            className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50"
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
