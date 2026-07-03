import { ChevronLeft, Zap } from 'lucide-react'
import type { Car } from './CarSelector'
import { Combobox } from './Combobox'
import { VehicleThumbnail } from './VehicleThumbnail'
import { partTypesForVehicle, popularPartTypesForVehicle } from '../data/partTypes'
import { isElectricVehicle } from '../data/electricVehicles'

export function PartSelector({
  car,
  onSelect,
  onBack,
}: {
  car: Car
  onSelect: (part: string) => void
  onBack: () => void
}) {
  const electric = isElectricVehicle(car.make, car.model)
  const partTypes = partTypesForVehicle(electric)
  const popularPartTypes = popularPartTypesForVehicle(electric)

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <VehicleThumbnail make={car.make} model={car.model} className="h-11 w-16" iconSize={20} />
          <div>
            <h2 className="text-lg font-bold text-slate-900">What part do you need?</h2>
            <p className="text-sm text-slate-500">
              For your{' '}
              <span className="font-medium text-slate-700">
                {car.year} {car.make} {car.model}
                {car.trim && ` ${car.trim}`}
              </span>
            </p>
          </div>
        </div>
        <button type="button" onClick={onBack} className="btn btn-ghost -mr-2 shrink-0 px-2 py-1.5">
          <ChevronLeft size={16} /> <span className="hidden sm:inline">Change</span>
        </button>
      </div>

      {electric && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
          <Zap size={14} /> Electric vehicle detected — engine-only parts (spark plugs, oil filter, etc.) are hidden.
        </p>
      )}

      <div className="mt-5">
        <Combobox
          label="Part type"
          placeholder="Search any part (e.g. outer tie rods)"
          options={partTypes.map((p) => p.name)}
          value=""
          onChange={(part) => onSelect(part)}
          allowFreeText
        />
        <p className="mt-1.5 text-xs text-slate-400">Pick from the list, or type any part name and press Enter.</p>
      </div>

      <div className="mt-6">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Popular parts</p>
        <div className="flex flex-wrap gap-2">
          {popularPartTypes.map((part) => (
            <button
              key={part.name}
              type="button"
              onClick={() => onSelect(part.name)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {part.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
