import { Car as CarIcon, Wrench, ListChecks, Check } from 'lucide-react'

type Step = 'car' | 'part' | 'results'

const steps: { id: Step; label: string; shortLabel: string; icon: typeof CarIcon }[] = [
  { id: 'car', label: 'Select vehicle', shortLabel: 'Vehicle', icon: CarIcon },
  { id: 'part', label: 'Choose part', shortLabel: 'Part', icon: Wrench },
  { id: 'results', label: 'Compare prices', shortLabel: 'Results', icon: ListChecks },
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
                <div
                  aria-hidden
                  className={`mx-2 h-0.5 w-10 transition-colors sm:w-20 ${
                    done || active ? 'bg-brand-400' : 'bg-slate-200'
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-2 rounded-full px-1 py-0.5 transition ${
                  active ? 'bg-brand-50' : ''
                }`}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    done
                      ? 'bg-brand-600 text-white'
                      : active
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25 ring-4 ring-brand-100'
                        : 'border border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {done ? <Check size={15} strokeWidth={2.5} /> : <Icon size={15} strokeWidth={2.2} />}
                </span>
                <span
                  className={`hidden text-sm font-semibold sm:block ${
                    active ? 'text-slate-900' : done ? 'text-brand-700' : 'text-slate-400'
                  }`}
                >
                  {step.shortLabel}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-slate-500 sm:hidden">{steps[currentIndex]?.label}</p>
    </nav>
  )
}