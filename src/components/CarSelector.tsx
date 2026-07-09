import { useEffect, useRef, useState } from 'react'
import { ArrowRight, AlertCircle, X, BookmarkPlus, Check, ScanLine, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { fetchMakes, fetchModels, fetchTrims, decodeVinApi, type VehicleType } from '../api/client'
import { Combobox } from './Combobox'
import { VehicleThumbnail } from './VehicleThumbnail'
import { VehicleHealthModal } from './VehicleHealthModal'
import { cachedRecallCount } from '../lib/recallCache'

export type Car = {
  year: string
  make: string
  model: string
  trim: string
}

// Garage entries carry optional enrichment (VIN from a decode, user-entered
// mileage). All fields optional so pre-existing localStorage entries parse.
export type GarageVehicle = Car & { vin?: string; mileage?: number }

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

export function CarSelector({
  onConfirm,
  onSearchPart,
}: {
  onConfirm: (car: Car) => void
  onSearchPart?: (car: Car, part: string) => void
}) {
  const [vehicleType, setVehicleType] = useState<VehicleType>('all')
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [trim, setTrim] = useState('')

  const [vinInput, setVinInput] = useState('')
  const [vinLoading, setVinLoading] = useState(false)
  const [vinError, setVinError] = useState<string | null>(null)
  // The VIN that produced the current selection; cleared on any manual change
  // so a stale VIN is never saved onto a hand-edited vehicle.
  const [decodedVin, setDecodedVin] = useState<string | null>(null)
  // Model/trim from a decode must be applied AFTER the models/trims effects
  // run, because those effects clear model and trim when year/make change.
  const pendingVin = useRef<{ model: string; trim: string } | null>(null)

  const [garage, setGarage] = useState<GarageVehicle[]>(() => {
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

  const addToGarage = (carToAdd: GarageVehicle) => {
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

  const [healthIndex, setHealthIndex] = useState<number | null>(null)

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
        if (pendingVin.current) {
          const match = res.models.find((m) => m.toLowerCase() === pendingVin.current!.model.toLowerCase())
          setModel(match ?? pendingVin.current.model)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          pendingVin.current = null
        }
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
        if (pendingVin.current) {
          const want = pendingVin.current.trim
          const match = res.trims.find((t) => t.toLowerCase() === want.toLowerCase())
          setTrim(match ?? want)
          pendingVin.current = null
        }
      })
      .catch(() => {
        // Trim data is a nice-to-have; fall back to free text silently on failure.
        if (!cancelled) {
          setTrims([])
          if (pendingVin.current) {
            setTrim(pendingVin.current.trim)
            pendingVin.current = null
          }
        }
      })
      .finally(() => {
        if (!cancelled) setTrimsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [make, year, model])

  const canConfirm = Boolean(year && make && model)

  const handleDecodeVin = async () => {
    setVinLoading(true)
    setVinError(null)
    try {
      const d = await decodeVinApi(vinInput)
      pendingVin.current = { model: d.model, trim: d.trim || '' }
      setYear(d.year)
      setMake(d.make)
      setDecodedVin(vinInput)
      const engineBits = [
        d.engine.displacementL && `${d.engine.displacementL}L`,
        d.engine.cylinders && `${d.engine.cylinders}-cyl`,
        d.engine.driveType,
      ].filter(Boolean).join(' · ')
      toast.success(`Decoded: ${d.year} ${d.make} ${d.model}${engineBits ? ` — ${engineBits}` : ''}`)
    } catch (err) {
      setVinError(err instanceof Error ? err.message : "Couldn't decode that VIN — pick your vehicle manually below")
    } finally {
      setVinLoading(false)
    }
  }

  return (
    <div className="card p-7">
      <div>
        <h2 className="section-title">Select your vehicle</h2>
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
                  <VehicleThumbnail make={c.make} model={c.model} year={c.year} className="h-9 w-14 rounded-lg" iconSize={16} />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate text-xs">
                      {c.year} {c.make} {c.model}
                    </div>
                    {c.trim && <div className="text-[10px] text-slate-400 truncate">{c.trim}</div>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {(() => {
                    const count = cachedRecallCount(c.year, c.make, c.model)
                    return count != null && count > 0 ? (
                      <span className="badge bg-rose-100 text-rose-700 px-1.5 text-[10px]">
                        {count} recall{count === 1 ? '' : 's'}
                      </span>
                    ) : null
                  })()}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setHealthIndex(i)
                    }}
                    aria-label={`Vehicle health for ${c.year} ${c.make} ${c.model}`}
                    className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-brand-600 transition"
                  >
                    <Activity size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => removeFromGarage(i, e)}
                    aria-label="Remove vehicle"
                    className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-rose-600 transition"
                  >
                    <X size={13} />
                  </button>
                </div>
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
        <label htmlFor="vin-input" className="field-label flex items-center gap-1.5">
          <ScanLine size={13} className="text-brand-600" /> Have your VIN? Decode it (fastest)
        </label>
        <div className="flex gap-2">
          <input
            id="vin-input"
            type="text"
            value={vinInput}
            onChange={(e) => {
              setVinInput(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))
              setVinError(null)
            }}
            placeholder="17-character VIN — driver's door jamb or windshield"
            maxLength={17}
            className="field font-data flex-1 uppercase tracking-[0.08em]"
          />
          <button
            type="button"
            onClick={handleDecodeVin}
            disabled={vinInput.length !== 17 || vinLoading}
            className="btn btn-secondary shrink-0 px-4"
          >
            {vinLoading ? 'Decoding…' : 'Decode'}
          </button>
        </div>
        {vinError && <p className="mt-1.5 text-xs text-rose-600">{vinError}</p>}
      </div>

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
          onChange={(v) => { setYear(v); setDecodedVin(null) }}
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
            onChange={(v) => { setMake(v); setDecodedVin(null) }}
            disabled={makesLoading}
          />
        </div>
        <Combobox
          label="Model"
          placeholder={!make || !year ? 'Pick year & make first' : modelsLoading ? 'Loading models…' : 'Select model'}
          options={models}
          value={model}
          onChange={(v) => { setModel(v); setDecodedVin(null) }}
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
        <div className="spec-plate mt-8 max-w-3xl mx-auto overflow-hidden">
          <span className="spec-plate-rivet left-3 top-3" />
          <span className="spec-plate-rivet right-3 top-3" />
          <span className="spec-plate-rivet left-3 bottom-3" />
          <span className="spec-plate-rivet right-3 bottom-3" />

          <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <div className="relative shrink-0 overflow-hidden rounded-lg bg-slate-800 ring-1 ring-white/10">
                <VehicleThumbnail make={make} model={model} year={year} className="h-16 w-24 sm:h-[92px] sm:w-[138px] object-cover" iconSize={28} />
              </div>

              <div className="min-w-0 py-0.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-400" />
                  <span className="font-data text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Fitment lock — active
                  </span>
                </div>

                <h3 className="font-data text-lg font-semibold leading-tight tracking-tight text-white sm:text-xl">
                  <span className="text-slate-500">{year}</span>{' '}
                  {make.toUpperCase()} {model.toUpperCase()}
                </h3>

                {trim && (
                  <p className="font-data mt-1 text-[12px] font-medium text-slate-400">
                    TRIM · {trim.toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-start sm:justify-end">
              <button
                type="button"
                onClick={() => addToGarage({ year, make, model, trim, ...(decodedVin ? { vin: decodedVin } : {}) })}
                disabled={garage.some(c => c.year === year && c.make === make && c.model === model && c.trim === trim)}
                className="group/btn relative flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:border-white/25 hover:bg-white/10 disabled:opacity-40"
              >
                {garage.some(c => c.year === year && c.make === make && c.model === model && c.trim === trim) ? (
                  <>
                    <Check size={16} className="text-emerald-400" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={16} className="text-slate-300 transition-transform group-hover/btn:scale-110" />
                    <span>Save to Garage</span>
                  </>
                )}
              </button>
            </div>
          </div>
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

      {healthIndex !== null && garage[healthIndex] && (
        <VehicleHealthModal
          vehicle={garage[healthIndex]}
          onClose={() => setHealthIndex(null)}
          onUpdateMileage={(mileage) =>
            setGarage((prev) => prev.map((c, i) => (i === healthIndex ? { ...c, mileage } : c)))
          }
          onShopPart={(shopPart) => {
            const v = garage[healthIndex]
            setHealthIndex(null)
            onSearchPart?.({ year: v.year, make: v.make, model: v.model, trim: v.trim }, shopPart)
          }}
        />
      )}
    </div>
  )
}
