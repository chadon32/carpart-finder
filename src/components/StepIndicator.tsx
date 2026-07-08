import { Car as CarIcon, Wrench, ListChecks, Check } from 'lucide-react'

type Step = 'car' | 'part' | 'results'

const steps: { id: Step; label: string; shortLabel: string; icon: typeof CarIcon }[] = [
  { id: 'car', label: 'Select vehicle', shortLabel: 'Vehicle', icon: CarIcon },
  { id: 'part', label: 'Choose part', shortLabel: 'Part', icon: Wrench },
  { id: 'results', label: 'Compare prices', shortLabel: 'Prices', icon: ListChecks },
]

export function StepIndicator({ current }: { current: Step }) {
  const currentIndex = steps.findIndex((s) => s.id === current)

  return (
    <nav aria-label="Search progress" className="mb-7">
      <ol className="flex items-center justify-center">
        {steps.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          const Icon = step.icon

          return (
            <li key={step.id} className="flex items-center">
              {i > 0 && (
                <div aria-hidden className="relative mx-2.5 h-px w-10 overflow-hidden bg-slate-200 dark:bg-slate-800 sm:w-20">
                  {/* Progress fills the connector like a gauge needle sweeping */}
                  <div
                    className={`absolute inset-y-0 left-0 bg-brand-500 transition-all duration-500 ease-out ${
                      done || active ? 'w-full' : 'w-0'
                    }`}
                  />
                </div>
              )}
              <div
                className={`flex items-center gap-2 rounded-full px-1.5 py-0.5 transition ${
                  active ? 'bg-brand-50/50 dark:bg-brand-900/10' : ''
                }`}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                    done
                      ? 'bg-brand-500 text-white'
                      : active
                        ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 ring-4 ring-brand-100 dark:ring-brand-900/25'
                        : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {done ? <Check size={15} strokeWidth={2.5} /> : <Icon size={15} strokeWidth={2.2} />}
                </span>
                <span className="hidden items-baseline gap-1.5 sm:flex">
                  <span
                    className={`font-data text-[10px] font-semibold ${
                      active || done ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-600'
                    }`}
                    aria-hidden
                  >
                    0{i + 1}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      active ? 'text-slate-900 dark:text-slate-100' : done ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {step.shortLabel}
                  </span>
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400 sm:hidden">{steps[currentIndex]?.label}</p>
    </nav>
  )
}
