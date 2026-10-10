import { Car as CarIcon, Wrench, ListChecks, Check } from 'lucide-react'

type Step = 'car' | 'part' | 'results'

const steps: { id: Step; label: string; shortLabel: string; icon: typeof CarIcon }[] = [
  { id: 'car', label: 'Select vehicle', shortLabel: 'Vehicle', icon: CarIcon },
  { id: 'part', label: 'Choose part', shortLabel: 'Part', icon: Wrench },
  { id: 'results', label: 'Compare prices', shortLabel: 'Prices', icon: ListChecks },
]

export function StepIndicator({ current, onNavigate }: { current: Step; onNavigate?: (step: Step) => void }) {
  const currentIndex = steps.findIndex((s) => s.id === current)

  return (
    <nav aria-label="Search progress" className="mb-7">
      <ol className="flex items-center justify-center">
        {steps.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          const Icon = step.icon
          // A finished step is a way back; the current and upcoming ones are not.
          const goBack = done && onNavigate ? () => onNavigate(step.id) : null

          const content = (
            <>
              <span
                className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  done
                    ? 'bg-brand-500 text-white'
                    : active
                      ? 'bg-brand-500 text-white ring-4 ring-brand-100 dark:ring-brand-900/25'
                      : 'border border-line dark:border-slate-800 bg-surface dark:bg-slate-900 text-ink-4 dark:text-slate-400'
                }`}
              >
                {done ? <Check size={15} strokeWidth={2.5} /> : <Icon size={15} strokeWidth={2.2} />}
              </span>
              <span className="hidden items-baseline gap-1.5 sm:flex">
                <span
                  className={`font-data text-xs font-semibold ${
                    active || done ? 'text-brand-600 dark:text-brand-400' : 'text-ink-4 dark:text-slate-400'
                  }`}
                  aria-hidden
                >
                  0{i + 1}
                </span>
                <span
                  className={`text-sm font-semibold ${
                    active ? 'text-ink dark:text-slate-100' : done ? 'text-brand-600 dark:text-brand-400' : 'text-ink-4 dark:text-slate-400'
                  }`}
                >
                  {step.shortLabel}
                </span>
              </span>
              {!goBack && <span className="sr-only sm:hidden">{step.label}{done ? ', completed' : ''}</span>}
            </>
          )

          return (
            <li key={step.id} className="flex items-center" aria-current={active ? 'step' : undefined}>
              {i > 0 && (
                <div aria-hidden className="relative mx-1 h-px w-[16px] overflow-hidden bg-slate-200 dark:bg-slate-800 sm:mx-2.5 sm:w-20">
                  {/* Progress fills the connector like a gauge needle sweeping */}
                  <div
                    className={`absolute inset-y-0 left-0 bg-brand-500 transition-all duration-500 ease-out ${
                      done || active ? 'w-full' : 'w-0'
                    }`}
                  />
                </div>
              )}
              {goBack ? (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label={`Change ${step.shortLabel.toLowerCase()}`}
                  className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center gap-2 rounded-full px-1.5 py-0.5 transition hover:bg-brand-50 dark:hover:bg-brand-900/20"
                >
                  {content}
                </button>
              ) : (
                <div className={`flex min-h-11 items-center gap-2 rounded-full px-1.5 py-0.5 transition ${active ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''}`}>
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-ink-4 sm:hidden">{steps[currentIndex]?.label}</p>
    </nav>
  )
}
