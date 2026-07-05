import { useEffect, useState } from 'react'
import { ArrowRight, AlertCircle, X } from 'lucide-react'
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

// Top 30 most popular car makes in the USA, matched case-insensitively
// against NHTSA's (uppercase) make names. Order here = display order.
const POPULAR_MAKES = [
  'Toyota', 'Ford', 'Chevrolet', 'Honda', 'Nissan', 'Hyundai', 'Kia',
  'Jeep', 'Subaru', 'GMC', 'Ram', 'Mazda', 'Volkswagen', 'BMW',
  'Mercedes-Benz', 'Tesla', 'Dodge', 'Lexus', 'Buick', 'Chrysler',
  'Acura', 'Audi', 'Cadillac', 'Mitsubishi', 'Volvo', 'Lincoln',
  'Genesis', 'Infiniti', 'Land Rover', 'Mini',
]
const POPULAR_RANK = new Map(POPULAR_MAKES.map((m, i) => [m.toUpperCase(), i]))

export function CarSelector({ onConfirm }: { onConfirm: (car: Car) => void }) {
  const [vehicleType, setVehicleType] = useState<VehicleType>('all')
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [trim, setTrim] = useState('')

  const [garage, setGarage] = useState<Car[]>(() => {
    try {
      const raw = localStorage.getItem('carpartsradar-garage')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('carpartsradar-garage', JSON.stringify(garage))
  }, [garage])

  const addToGarage = (carToAdd: Car) => {
    setGarage((prev) => {
      const exists = prev.some(
        (c) =>
          c.year === carToAdd.year &&
          c.make === carToAdd.make &&
          c.model === carToAdd.model &&
          c.trim === carToAdd.trim
      )
      if (exists) return prev
      return [...prev, carToAdd]
    })
  }

  const removeFromGarage = (indexToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setGarage((prev) => prev.filter((_, i) => i !== indexToRemove))
  }

  const [makes, setMakes] = useState<string[]>([])

  // Split the fetched makes (which reflect the vehicle-type filter) into a
  // popular group and the rest — both drawn from real NHTSA data, so no make
  // can appear twice and no popular make appears that the filter excluded.
  const popularOptions = makes
    .filter((m) => POPULAR_RANK.has(m.toUpperCase()))
    .sort((a, b) => POPULAR_RANK.get(a.toUpperCase())! - POPULAR_RANK.get(b.toUpperCase())!)
  const otherOptions = makes.filter((m) => !POPULAR_RANK.has(m.toUpperCase()))
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
    <div className="card p-7">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Select your vehicle</h2>
        <p className="mt-1 text-sm text-slate-600">We filter listings to fit the exact vehicle you pick.</p>
      </div>

      {/* My Garage */}
      {garage.length > 0 && (
        <div className="mt-6 border-b border-slate-100 pb-6 dark:border-slate-800/60">
          <h3 className="eyebrow mb-3">My Garage</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {garage.map((c, i) => (
              <div
                key={i}
                onClick={() => {
                  setYear(c.year)
                  setMake(c.make)
                  setModel(c.model)
                  setTrim(c.trim)
                }}
                className={`group flex items-center justify-between gap-3 cursor-pointer rounded-xl border p-3 transition-all ${
                  year === c.year && make === c.make && model === c.model && trim === c.trim
                    ? 'border-brand-500 bg-brand-50/20'
                    : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <VehicleThumbnail make={c.make} model={c.model} className="h-9 w-14 rounded-lg" iconSize={16} />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate text-xs">
                      {c.year} {c.make} {c.model}
                    </div>
                    {c.trim && <div className="text-[10px] text-slate-400 truncate">{c.trim}</div>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => removeFromGarage(i, e)}
                  aria-label="Remove vehicle"
                  className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-rose-600 transition"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
          <AlertCircle size={15} className="shrink-0" />
          Couldn't load vehicle data — check your connection and try again.
        </p>
      )}

      <div className="mt-6">
        <label className="field-label">Vehicle type</label>
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
        <div>
          <label className="field-label">Make</label>

          {/* Single dropdown with Popular Makes at the top, then All Makes */}
          <Combobox
            label=""
            placeholder={makesLoading ? 'Loading makes…' : 'Select make'}
            groups={[
              ...(popularOptions.length > 0 ? [{ label: 'Popular Makes', options: popularOptions }] : []),
              { label: 'All Makes', options: otherOptions },
            ]}
            value={make}
            onChange={(v) => setMake(v)}
            disabled={makesLoading}
          />
        </div>
        <Combobox
          label="Model"
          placeholder={!make || !year ? 'Pick year & make first' : modelsLoading ? 'Loading models…' : 'Select model'}
          options={models}
          value={model}
          onChange={(v) => setModel(v)}
          disabled={!make || !year || modelsLoading}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="field-label mb-0">Trim (optional)</label>
          {trim && (
            <button type="button" onClick={() => setTrim('')} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Clear selection
            </button>
          )}
        </div>

        {trimsLoading ? (
          <div className="field bg-slate-50 text-slate-400">Loading trim options…</div>
        ) : trims.length > 0 ? (
          <>
            {/* Nice card-style selector when there aren't too many options */}
            {trims.length <= 8 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setTrim('')}
                  className={`rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                    !trim
                      ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600/20'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Any trim
                </button>
                {trims.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrim(t)}
                    className={`rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                      trim === t
                        ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600/20'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <Combobox label="" placeholder="Select trim" options={trims} value={trim} onChange={(v) => setTrim(v)} />
            )}
            <p className="mt-2 text-xs text-slate-500">Showing real fitment options from eBay compatibility data.</p>
          </>
        ) : (
          <input
            type="text"
            value={trim}
            onChange={(e) => setTrim(e.target.value)}
            placeholder="e.g. LE, Sport, Limited (optional)"
            className="field"
          />
        )}
      </div>

      {make && model && (
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-brand-200/50 bg-gradient-to-br from-brand-50/40 via-white to-white p-4 shadow-sm sm:flex-row items-center justify-between">
          <div className="flex flex-col items-center gap-4 sm:flex-row min-w-0">
            <VehicleThumbnail make={make} model={model} className="h-20 w-32 sm:h-24 sm:w-40" iconSize={36} />
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-[10px] font-bold uppercase tracking-[1px] text-brand-600">Active Vehicle</p>
              <p className="mt-1 text-base font-bold tracking-tight text-slate-950">
                {year} {make} {model}
              </p>
              {trim && <p className="text-xs text-slate-500">{trim}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => addToGarage({ year, make, model, trim })}
            disabled={garage.some(c => c.year === year && c.make === make && c.model === model && c.trim === trim)}
            className="btn btn-secondary btn-sm shrink-0 self-center sm:self-end disabled:opacity-40"
          >
            Save to Garage
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => onConfirm({ year, make, model, trim: trim.trim() })}
        className="btn btn-primary btn-lg mt-6 w-full sm:w-auto"
      >
        Continue to parts
        <ArrowRight size={16} strokeWidth={2.4} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  )
}
