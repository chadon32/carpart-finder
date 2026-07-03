import { useEffect, useState } from 'react'
import { Car as CarIcon, ArrowRight, AlertCircle } from 'lucide-react'
import { fetchMakes, fetchModels, fetchTrims, type VehicleType } from '../api/client'
import { Combobox } from './Combobox'
import { VehicleThumbnail } from './VehicleThumbnail'

export type Car = {
  year: string
  make: string
  model: string
  trim: string
}

const currentYear = new Date().getFullYear()
const years = Array.from({ length: currentYear - 1980 + 2 }, (_, i) => String(currentYear + 1 - i))

const vehicleTypeOptions: { value: VehicleType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'car', label: 'Car' },
  { value: 'suv', label: 'SUV / Minivan' },
  { value: 'truck', label: 'Truck' },
]

export function CarSelector({ onConfirm }: { onConfirm: (car: Car) => void }) {
  const [vehicleType, setVehicleType] = useState<VehicleType>('all')
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [trim, setTrim] = useState('')

  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [trims, setTrims] = useState<string[]>([])

  const [makesLoading, setMakesLoading] = useState(true)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [trimsLoading, setTrimsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setMakesLoading(true)
    setMake('')
    fetchMakes(vehicleType)
      .then((res) => {
        if (cancelled) return
        setMakes(res.makes)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setMakesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vehicleType])

  useEffect(() => {
    let cancelled = false
    setModel('')
    setModels([])
    if (!make || !year) return
    setModelsLoading(true)
    setError(null)
    fetchModels(make, year)
      .then((res) => {
        if (cancelled) return
        setModels(res.models)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [make, year])

  useEffect(() => {
    let cancelled = false
    setTrim('')
    setTrims([])
    if (!make || !year || !model) return
    setTrimsLoading(true)
    fetchTrims(year, make, model)
      .then((res) => {
        if (cancelled) return
        setTrims(res.trims)
      })
      .catch(() => {
        // Trim data is a nice-to-have; fall back to free text silently on failure.
        if (!cancelled) setTrims([])
      })
      .finally(() => {
        if (!cancelled) setTrimsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [make, year, model])

  const canConfirm = Boolean(year && make && model)

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <CarIcon size={18} strokeWidth={2.2} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Select your vehicle</h2>
          <p className="text-sm text-slate-500">We only show parts that fit your exact car.</p>
        </div>
      </div>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={15} /> {error}
        </p>
      )}

      <div className="mt-5">
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Vehicle type</label>
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {vehicleTypeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setVehicleType(opt.value)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                vehicleType === opt.value
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Combobox
          label="Year"
          placeholder="Select year"
          options={years}
          value={year}
          onChange={(v) => setYear(v)}
        />
        <Combobox
          label="Make"
          placeholder={makesLoading ? 'Loading makes…' : 'Select make'}
          options={makes}
          value={make}
          onChange={(v) => setMake(v)}
          disabled={makesLoading}
        />
        <Combobox
          label="Model"
          placeholder={!make || !year ? 'Pick year & make first' : modelsLoading ? 'Loading models…' : 'Select model'}
          options={models}
          value={model}
          onChange={(v) => setModel(v)}
          disabled={!make || !year || modelsLoading}
        />
      </div>

      <div className="mt-4 sm:w-1/2">
        {trimsLoading ? (
          <>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Trim (optional)</label>
            <input disabled value="" onChange={() => {}} placeholder="Loading trims…" className="field" />
          </>
        ) : trims.length > 0 ? (
          <>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-semibold text-slate-700">Trim (optional)</label>
              {trim && (
                <button type="button" onClick={() => setTrim('')} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                  Clear
                </button>
              )}
            </div>
            <Combobox label="" placeholder="Select trim" options={trims} value={trim} onChange={(v) => setTrim(v)} />
            <p className="mt-1.5 text-xs text-slate-400">Real fitment options from eBay's compatibility data.</p>
          </>
        ) : (
          <>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Trim (optional)</label>
            <input
              type="text"
              value={trim}
              onChange={(e) => setTrim(e.target.value)}
              placeholder="e.g. LE, Sport, Limited"
              className="field"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              No trim data for this vehicle — type it to narrow your search, or leave it blank.
            </p>
          </>
        )}
      </div>

      {make && model && (
        <div className="mt-5 flex items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
          <VehicleThumbnail make={make} model={model} className="h-20 w-32 sm:h-24 sm:w-40" iconSize={36} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Your vehicle</p>
            <p className="mt-0.5 truncate text-base font-bold text-slate-900">
              {year} {make} {model}
            </p>
            {trim && <p className="truncate text-sm text-slate-500">{trim}</p>}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => onConfirm({ year, make, model, trim: trim.trim() })}
        className="btn btn-primary mt-6 w-full px-6 py-3 sm:w-auto"
      >
        Continue to parts
        <ArrowRight size={16} strokeWidth={2.4} />
      </button>
    </div>
  )
}
