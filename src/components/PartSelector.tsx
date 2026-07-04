import { Zap } from 'lucide-react'
import type { Car } from './CarSelector'
import { Combobox } from './Combobox'
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
    <div className="card p-7">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">What part do you need?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Showing parts for{' '}
            <span className="font-medium text-slate-800">
              {car.year} {car.make} {car.model}
              {car.trim && ` ${car.trim}`}
            </span>
          </p>
        </div>
        <button type="button" onClick={onBack} className="btn btn-ghost px-3 py-1.5 text-sm">
          Change vehicle
        </button>
      </div>

      {electric && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
          <Zap size={14} /> Electric vehicle detected — engine-only parts (spark plugs, oil filter, etc.) are hidden.
        </p>
      )}

      <div className="mt-5">
        <div className="mb-2 text-xs text-slate-500">Or search by part number</div>
        <input
          type="text"
          placeholder="Enter part number (e.g. 04465-0K010)"
          className="field mb-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
              const partNum = e.currentTarget.value.trim()
              alert(`Searching by part number: ${partNum}`)
              onSelect(partNum)
            }
          }}
        />
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
            <button key={part.name} type="button" onClick={() => onSelect(part.name)} className="chip">
              {part.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
