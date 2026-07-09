import { X } from 'lucide-react'
import { Modal } from './Modal'

type ConditionFilter = 'all' | 'new' | 'used'

// Mobile-first filter panel for the results list. Rendered through Modal, so
// it opens as a bottom sheet on phones and a centered dialog on desktop.
// All state lives in ResultsList (persisted); this is a pure control surface.
export function FilterSheet({
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
    <Modal label="Filter listings" onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800/60">
        <h3 className="section-title text-lg">Filters</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="hidden rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 sm:block"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div>
          <div className="field-label">Condition</div>
          <div className="inline-flex gap-0.5 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            {(['all', 'new', 'used'] as ConditionFilter[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCondition(c)}
                className={`min-h-[40px] touch-manipulation rounded-full px-5 text-xs font-semibold capitalize transition ${
                  condition === c ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Hide overseas listings</span>
          <input
            type="checkbox"
            checked={hideOverseas}
            onChange={(e) => onHideOverseas(e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
        </label>

        <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Arrives within a week</span>
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
            <span className="font-data text-sm font-semibold text-slate-700 dark:text-slate-300">{minRating}%</span>
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
          <p className="mt-1.5 text-xs text-slate-500">Used for delivery estimates on each listing.</p>
        </div>
      </div>

      <div className="flex gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800/60">
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
