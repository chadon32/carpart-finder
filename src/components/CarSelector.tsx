import { Suspense, useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, AlertCircle, X, BookmarkPlus, Check, ScanLine, Activity, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { fetchMakes, fetchModels, fetchTrims, decodeVinApi } from '../api/client'
import { Combobox } from './Combobox'
import { StickyActionBar } from './StickyActionBar'
import { VehicleThumbnail } from './VehicleThumbnail'
import { cachedRecallCount } from '../lib/recallCache'
import { normalizeMake } from '../../shared/vehicleMake.js'
import { lazyWithRecovery } from '../lib/lazyWithRecovery'

const VehicleHealthModal = lazyWithRecovery(() =>
  import('./VehicleHealthModal').then((module) => ({ default: module.VehicleHealthModal }))
)

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

// Vehicles saved before makes were shown in readable case carry the NHTSA
// spelling ("HONDA"). Convert on load so they match what is selected today,
// and drop the duplicates that conversion can create.
function readableGarage(saved: GarageVehicle[]): GarageVehicle[] {
  const seen = new Set<string>()
  const vehicles: GarageVehicle[] = []
  for (const entry of saved) {
    const vehicle = { ...entry, make: normalizeMake(entry.make) }
    const key = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].join('|').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    vehicles.push(vehicle)
  }
  return vehicles
}

export function CarSelector({
  onConfirm,
  onSearchPart,
}: {
  onConfirm: (car: Car) => void
  onSearchPart?: (car: Car, part: string) => void
}) {
  const [year, setYear] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [trim, setTrim] = useState('')
  const trimInputId = useId()

  const [vinOpen, setVinOpen] = useState(false)
  const vinInputRef = useRef<HTMLInputElement>(null)
  const [vinInput, setVinInput] = useState('')
  const [vinLoading, setVinLoading] = useState(false)
  const [vinError, setVinError] = useState<string | null>(null)
  // The VIN that produced the current selection; cleared on any manual change
  // so a stale VIN is never saved onto a hand-edited vehicle.
  const [decodedVin, setDecodedVin] = useState<string | null>(null)
  // Model/trim from a VIN or saved Garage vehicle must be applied AFTER the
  // models/trims effects run, because those effects clear dependent fields
  // when year, make, or model changes.
  const pendingSelection = useRef<{ model: string; trim: string } | null>(null)

  const [garage, setGarage] = useState<GarageVehicle[]>(() => {
    try {
      const raw = localStorage.getItem('carpartsradar-garage')
      const saved: unknown = raw ? JSON.parse(raw) : []
      return Array.isArray(saved) ? readableGarage(saved as GarageVehicle[]) : []
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
    fetchMakes()
      .then((res) => {
        if (cancelled) return
        setMakes([...new Set(res.makes.map(normalizeMake))])
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
  }, [])

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
        if (pendingSelection.current) {
          const match = res.models.find((m) => m.toLowerCase() === pendingSelection.current!.model.toLowerCase())
          setModel(match ?? pendingSelection.current.model)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          pendingSelection.current = null
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
        if (pendingSelection.current) {
          const want = pendingSelection.current.trim
          const match = res.trims.find((t) => t.toLowerCase() === want.toLowerCase())
          setTrim(match ?? want)
          pendingSelection.current = null
        }
      })
      .catch(() => {
        // Trim data is a nice-to-have; fall back to free text silently on failure.
        if (!cancelled) {
          setTrims([])
          if (pendingSelection.current) {
            setTrim(pendingSelection.current.trim)
            pendingSelection.current = null
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

  // Tapping "Have a VIN?" should land in the field, not make people find it.
  useEffect(() => {
    if (vinOpen) vinInputRef.current?.focus()
  }, [vinOpen])

  const canConfirm = Boolean(year && make && model)

  const handleDecodeVin = async () => {
    setVinLoading(true)
    setVinError(null)
    try {
      const d = await decodeVinApi(vinInput)
      pendingSelection.current = { model: d.model, trim: d.trim || '' }
      setYear(d.year)
      setMake(normalizeMake(d.make))
      setDecodedVin(vinInput)
      setVinOpen(false)
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

  const selectGarageVehicle = (vehicle: GarageVehicle) => {
    setDecodedVin(vehicle.vin ?? null)
    pendingSelection.current = { model: vehicle.model, trim: vehicle.trim }

    // When year and make are unchanged, their loading effect will not run, so
    // advance the model here and let the trim effect finish the selection.
    if (year === vehicle.year && make === vehicle.make) {
      if (model === vehicle.model) {
        setTrim(vehicle.trim)
        pendingSelection.current = null
      } else {
        setModel(vehicle.model)
      }
      return
    }

    setYear(vehicle.year)
    setMake(vehicle.make)
  }

  return (
    <div className="card p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="section-title">Select your vehicle</h2>
        <button
          type="button"
          onClick={() => setVinOpen((open) => !open)}
          aria-expanded={vinOpen}
          aria-controls="vin-panel"
          className="-mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
        >
          <ScanLine size={15} aria-hidden="true" /> Have a VIN?
          <ChevronDown size={15} aria-hidden="true" className={`transition ${vinOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Always rendered so aria-controls resolves; hidden until opened. */}
      <div id="vin-panel" hidden={!vinOpen} className="mt-3 rounded-xl border border-line bg-surface-2/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <label htmlFor="vin-input" className="field-label">Vehicle identification number (VIN)</label>
        <div className="flex gap-2">
          <input
            ref={vinInputRef}
            id="vin-input"
            type="text"
            value={vinInput}
            onChange={(e) => {
              setVinInput(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))
              setVinError(null)
            }}
            placeholder="17 characters"
            maxLength={17}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={Boolean(vinError)}
            aria-describedby={vinError ? 'vin-help vin-error' : 'vin-help'}
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
        <p id="vin-help" className="mt-1.5 text-sm text-ink-4">
          Find it on the driver's door jamb or the lower windshield. It has 17 letters and numbers, never I, O, or Q.
        </p>
        {vinError && <p id="vin-error" role="alert" className="mt-1.5 text-sm text-rose-700">{vinError}</p>}
      </div>

      {/* My Garage — hidden until a vehicle is saved; first-time visitors
          get the form, not a placeholder for a feature they haven't used. */}
      {garage.length > 0 && (
        <div className="mt-6 border-b border-line-soft pb-6 dark:border-slate-800/60">
          <h3 className="eyebrow mb-3">My Garage</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {garage.map((c, i) => (
              <div
                key={i}
                className={`group flex min-w-0 items-center gap-1 rounded-xl border p-1.5 transition-all ${
                  year === c.year && make === c.make && model === c.model && trim === c.trim
                    ? 'border-brand-500 bg-brand-50/20'
                    : 'border-line/80 bg-surface hover:border-slate-300 hover:bg-surface-2/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => selectGarageVehicle(c)}
                  aria-pressed={year === c.year && make === c.make && model === c.model && trim === c.trim}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left"
                >
                  <VehicleThumbnail make={c.make} model={c.model} year={c.year} className="h-9 w-14 rounded-lg" iconSize={16} />
                  <div className="min-w-0">
                    <div className="font-bold text-ink truncate text-xs">
                      {c.year} {c.make} {c.model}
                    </div>
                    {c.trim && <div className="text-xs text-ink-4 truncate">{c.trim}</div>}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {(() => {
                    const count = cachedRecallCount(c.year, c.make, c.model)
                    return count != null && count > 0 ? (
                      <span className="badge bg-rose-100 text-rose-700 px-1.5">
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
                    className="-m-1.5 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-4 transition hover:bg-surface-3 hover:text-brand-600"
                  >
                    <Activity size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => removeFromGarage(i, e)}
                    aria-label="Remove vehicle"
                    className="-m-1.5 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-4 transition hover:bg-surface-3 hover:text-rose-600"
                  >
                    <X size={16} />
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

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Combobox
          label="Year"
          placeholder="Select year"
          options={years}
          value={year}
          onChange={(v) => { pendingSelection.current = null; setYear(v); setDecodedVin(null) }}
        />
        <div>
          {/* Single dropdown with Popular Makes at the top, then All Makes */}
          <Combobox
            label="Make"
            placeholder={makesLoading ? 'Loading makes…' : 'Select make'}
            groups={[
              ...(popularOptions.length > 0 ? [{ label: 'Popular Makes', options: popularOptions }] : []),
              { label: 'All Makes', options: otherOptions },
            ]}
            value={make}
            onChange={(v) => { pendingSelection.current = null; setMake(v); setDecodedVin(null) }}
            disabled={makesLoading}
          />
        </div>
        <Combobox
          label="Model"
          placeholder={!make || !year ? 'Pick year & make first' : modelsLoading ? 'Loading models…' : 'Select model'}
          options={models}
          value={model}
          onChange={(v) => { pendingSelection.current = null; setModel(v); setDecodedVin(null) }}
          disabled={!make || !year || modelsLoading}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          {trims.length > 0 && trims.length <= 8 ? (
            <span className="field-label mb-0">Trim (optional)</span>
          ) : (
            <label htmlFor={trimInputId} className="field-label mb-0">Trim (optional)</label>
          )}
          {trim && (
            <button type="button" onClick={() => setTrim('')} className="-my-2 min-h-11 py-2 text-xs font-medium text-brand-600 hover:text-brand-700">
              Clear selection
            </button>
          )}
        </div>
        <p className="mb-2 text-sm leading-relaxed text-ink-4">
          Trim is the package name, such as LE, Sport, or Limited. Leave it blank if you are not sure.
        </p>

        {trimsLoading ? (
          <div className="field bg-surface-2 text-ink-4">Loading trim options…</div>
        ) : trims.length > 0 ? (
          <>
            {/* Nice card-style selector when there aren't too many options */}
            {trims.length <= 8 ? (
              <div role="group" aria-label="Trim" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setTrim('')}
                  aria-pressed={!trim}
                  className={`min-h-11 touch-manipulation rounded-xl border px-4 py-3 text-left text-sm font-medium transition sm:py-2.5 ${
                    !trim
                      ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600/20 dark:bg-brand-950 dark:text-brand-400'
                      : 'border-line text-ink-2 hover:border-slate-300 hover:bg-surface-2'
                  }`}
                >
                  Any trim
                </button>
                {trims.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrim(t)}
                    aria-pressed={trim === t}
                    className={`min-h-11 touch-manipulation rounded-xl border px-4 py-3 text-left text-sm font-medium transition sm:py-2.5 ${
                      trim === t
                        ? 'border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-600/20 dark:bg-brand-950 dark:text-brand-400'
                        : 'border-line text-ink-2 hover:border-slate-300 hover:bg-surface-2'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : (
              <Combobox id={trimInputId} label="" ariaLabel="Trim (optional)" placeholder="Select trim" options={trims} value={trim} onChange={(v) => setTrim(v)} />
            )}
            <p className="mt-2 text-sm text-ink-4">Trim options come from eBay's vehicle data.</p>
          </>
        ) : (
          <input
            id={trimInputId}
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
                <VehicleThumbnail make={make} model={model} year={year} className="h-16 w-24 sm:h-[92px] sm:w-[138px] object-cover" iconSize={28} tone="dark" />
              </div>

              <div className="min-w-0 py-0.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-emerald-400" />
                  <span className="font-data text-xs font-semibold uppercase tracking-[0.14em] text-ink-5">
                    Your vehicle
                  </span>
                </div>

                <h3 className="font-data text-lg font-semibold leading-tight tracking-tight text-white sm:text-xl">
                  <span className="text-ink-4">{year}</span>{' '}
                  {make.toUpperCase()} {model.toUpperCase()}
                </h3>

                {trim && (
                  <p className="font-data mt-1 text-[12px] font-medium text-ink-5">
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
        className="btn btn-primary btn-lg mt-6 hidden w-full sm:inline-flex sm:w-auto"
      >
        Continue to parts
        <ArrowRight size={16} strokeWidth={2.4} className="transition-transform group-hover:translate-x-0.5" />
      </button>

      {canConfirm && (
        <StickyActionBar>
          <button
            type="button"
            onClick={() => onConfirm({ year, make, model, trim: trim.trim() })}
            className="btn btn-primary btn-lg w-full"
          >
            Continue to parts
            <ArrowRight size={16} strokeWidth={2.4} />
          </button>
        </StickyActionBar>
      )}

      {healthIndex !== null && garage[healthIndex] && (
        <Suspense
          fallback={(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45" role="status">
              <div className="rounded-xl bg-surface px-5 py-3 text-sm font-semibold text-ink-2 shadow-overlay">
                Loading vehicle health…
              </div>
            </div>
          )}
        >
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
        </Suspense>
      )}
    </div>
  )
}
