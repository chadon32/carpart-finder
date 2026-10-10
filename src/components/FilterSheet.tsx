import { X } from 'lucide-react'
import { Modal } from './Modal'
import { SORT_OPTIONS, type SortKey } from '../lib/listingSort'

type ConditionFilter = 'all' | 'new' | 'used'

// Mobile-first filter panel for the results list. Rendered through Modal, so
// it opens as a bottom sheet on phones and a centered dialog on desktop.
// State belongs to the results route/screen; this is a pure control surface.
export function FilterSheet({
  sortBy,
  onSortBy,
  condition,
  onCondition,
  hideOverseas,
  onHideOverseas,
  fastDelivery,
  onFastDelivery,
  minRating,
  onMinRating,
  zipInput,
  onZipInput,
  onCommitZip,
  onClearAll,
  onClose,
}: {
  sortBy: SortKey
  onSortBy: (sort: SortKey) => void
  condition: ConditionFilter
  onCondition: (c: ConditionFilter) => void
  hideOverseas: boolean
  onHideOverseas: (v: boolean) => void
  fastDelivery: boolean
  onFastDelivery: (v: boolean) => void
  minRating: number
  onMinRating: (v: number) => void
  zipInput: string
  onZipInput: (v: string) => void
  onCommitZip: () => void
  onClearAll: () => void
  onClose: () => void
}) {
  return (
    <Modal label="Sort and filter listings" onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between border-b border-line-soft px-5 py-4 dark:border-slate-800/60">
        <h3 className="section-title text-lg">Sort &amp; filters</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sort and filters"
          className="hidden rounded-full p-2 text-ink-5 hover:bg-surface-3 hover:text-ink-3 sm:block"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">
        <fieldset>
          <legend className="field-label">Sort by</legend>
          <div className="space-y-0.5">
            {SORT_OPTIONS.map((option) => (
              <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1">
                <input
                  type="radio"
                  name="sort-listings"
                  value={option.value}
                  checked={sortBy === option.value}
                  onChange={() => onSortBy(option.value)}
                  className="h-5 w-5 accent-brand-600"
                />
                <span className="text-sm font-medium text-ink-2">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <div className="field-label" id="filter-condition-label">Condition</div>
          <div role="group" aria-labelledby="filter-condition-label" className="inline-flex gap-0.5 rounded-full bg-surface-3 p-1">
            {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCondition(c)}
                aria-pressed={condition === c}
                className={`min-h-11 touch-manipulation rounded-full px-5 text-xs font-semibold capitalize transition ${
                  condition === c ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-3'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink-2">Hide overseas listings</span>
          <input
            type="checkbox"
            checked={hideOverseas}
            onChange={(e) => onHideOverseas(e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink-2">Arrives within a week</span>
          <input
            type="checkbox"
            checked={fastDelivery}
            onChange={(e) => onFastDelivery(e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="field-label mb-0">Minimum seller rating</span>
            <span className="font-data text-sm font-semibold text-ink-2">{minRating}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={minRating}
            onChange={(e) => onMinRating(Number(e.target.value))}
            aria-label="Minimum seller rating percentage"
            className="h-8 w-full accent-brand-600"
          />
        </div>

        <div>
          <label htmlFor="filter-zip" className="field-label">Delivery ZIP code</label>
          <input
            id="filter-zip"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            maxLength={5}
            value={zipInput}
            onChange={(e) => onZipInput(e.target.value.replace(/\D/g, ''))}
            onBlur={onCommitZip}
            placeholder="e.g. 90210"
            className="field"
          />
          <p className="mt-1.5 text-sm text-ink-4">Used for delivery estimates on each listing.</p>
        </div>
      </div>

      <div className="flex gap-3 border-t border-line-soft px-5 py-4 dark:border-slate-800/60">
        <button type="button" onClick={onClearAll} className="btn btn-secondary flex-1">
          Clear all
        </button>
        <button type="button" onClick={onClose} className="btn btn-primary flex-1">
          Show results
        </button>
      </div>
    </Modal>
  )
}
