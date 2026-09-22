import { useEffect, useState } from 'react'
import { AlertTriangle, Gauge, ShoppingCart } from 'lucide-react'
import { Modal } from './Modal'
import { RadarMark } from './RadarMark'
import { fetchRecalls, type Recall } from '../api/client'
import { readCachedRecalls, writeCachedRecalls } from '../lib/recallCache'
import { maintenanceForVehicle } from '../data/maintenanceSchedule'
import { isElectricVehicle } from '../data/electricVehicles'
import type { GarageVehicle } from './CarSelector'

export function VehicleHealthModal({
  vehicle,
  onClose,
  onUpdateMileage,
  onShopPart,
}: {
  vehicle: GarageVehicle
  onClose: () => void
  onUpdateMileage: (mileage: number | undefined) => void
  onShopPart: (part: string) => void
}) {
  const [recalls, setRecalls] = useState<Recall[] | null>(
    () => readCachedRecalls(vehicle.year, vehicle.make, vehicle.model)
  )
  const [recallsError, setRecallsError] = useState(false)
  const [recallAttempt, setRecallAttempt] = useState(0)
  const [mileageInput, setMileageInput] = useState(vehicle.mileage != null ? String(vehicle.mileage) : '')
  const [mileageError, setMileageError] = useState<string | null>(null)

  useEffect(() => {
    if (recalls !== null) return // session cache hit
    let cancelled = false
    const controller = new AbortController()
    fetchRecalls(vehicle.year, vehicle.make, vehicle.model, controller.signal)
      .then((res) => {
        if (cancelled) return
        setRecalls(res.recalls)
        writeCachedRecalls(vehicle.year, vehicle.make, vehicle.model, res.recalls)
      })
      .catch(() => {
        // An honest error line, never a silent empty state.
        if (!cancelled) setRecallsError(true)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [recalls, vehicle.year, vehicle.make, vehicle.model, recallAttempt])

  const commitMileage = () => {
    const value = mileageInput.trim()
    if (!value) {
      setMileageError(null)
      onUpdateMileage(undefined)
      return
    }

    if (!/^\d+$/.test(value)) {
      setMileageError('Enter mileage as a whole number.')
      return
    }

    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 1_000_000) {
      setMileageError('Enter mileage from 0 to 1,000,000.')
      return
    }

    setMileageError(null)
    onUpdateMileage(parsed)
  }

  const maintenance = maintenanceForVehicle(isElectricVehicle(vehicle.make, vehicle.model))
  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`

  return (
    <Modal label={`${vehicleLabel} — vehicle health`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="border-b px-6 py-4">
        <div className="eyebrow text-brand-600 dark:text-brand-400">Vehicle health</div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-slate-950">{vehicleLabel}</h2>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Gauge size={14} className="text-slate-400" />
            Mileage
            <input
              id="vehicle-mileage"
              type="text"
              inputMode="numeric"
              value={mileageInput}
              onChange={(e) => {
                setMileageInput(e.target.value)
                setMileageError(null)
              }}
              onBlur={commitMileage}
              placeholder="e.g. 84000"
              aria-invalid={Boolean(mileageError)}
              aria-describedby={mileageError ? 'vehicle-mileage-help vehicle-mileage-error' : 'vehicle-mileage-help'}
              className="field font-data w-28 px-3 py-1.5 text-sm"
            />
          </label>
        </div>
        <p id="vehicle-mileage-help" className="mt-1 text-xs text-slate-500">Optional. Enter a whole number from 0 to 1,000,000.</p>
        {mileageError && <p id="vehicle-mileage-error" role="alert" className="mt-1 text-xs text-rose-700 dark:text-rose-300">{mileageError}</p>}
        {vehicle.vin && (
          <p className="font-data mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-600">VIN · {vehicle.vin}</p>
        )}
      </div>

      <div className="space-y-8 p-6">
        <section>
          <h3 className="section-title text-lg">Model recall notices</h3>
          <p className="mt-0.5 text-xs text-slate-500">NHTSA notices for this year, make, and model — not your VIN's repair status.</p>
          <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline dark:text-sky-300">
            Check your VIN on NHTSA (opens a new tab)
          </a>

          {recallsError ? (
            <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
              <p className="flex items-center gap-2"><AlertTriangle size={15} className="shrink-0" />Couldn't load recall notices. Check your connection and try again.</p>
              <button type="button" className="btn btn-secondary mt-3" onClick={() => {
                setRecallsError(false)
                setRecallAttempt((attempt) => attempt + 1)
              }}>Retry recall lookup</button>
            </div>
          ) : recalls === null ? (
            <div className="mt-4 flex items-center gap-2.5 text-sm text-slate-500" role="status">
              <RadarMark className="h-5 w-5 text-brand-600 dark:text-brand-400" /> Checking NHTSA…
            </div>
          ) : recalls.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
              No recall notices were returned for this model. Check your VIN on NHTSA to confirm your vehicle's recall status.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recalls.map((r, i) => (
                <li key={r.campaignNumber ?? i} className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-rose-600 text-white">Recall</span>
                    {r.campaignNumber && (
                      <span className="font-data text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-700 dark:text-rose-300">
                        {r.campaignNumber}
                      </span>
                    )}
                    {r.reportedDate && <span className="text-[11px] text-slate-600">{r.reportedDate}</span>}
                  </div>
                  {r.component && <p className="mt-2 text-sm font-semibold text-slate-900">{r.component}</p>}
                  {r.summary && <p className="mt-1 text-sm leading-relaxed text-slate-600">{r.summary}</p>}
                  {r.remedy && (
                    <p className="mt-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">Remedy:</span> {r.remedy}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="section-title text-lg">Typical maintenance</h3>
          <p className="mt-0.5 text-xs text-slate-500">Typical intervals — always check your owner's manual.</p>
          <p className="mt-1 text-xs text-slate-500">Engine-specific services are omitted because this vehicle's engine is unconfirmed; your owner's manual controls.</p>
          <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
            {maintenance.map((m) => (
              <li key={m.part} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{m.part}</div>
                  <div className="text-xs text-slate-500">
                    <span className="font-data">~{m.intervalMiles.toLocaleString()} mi</span> · {m.note}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onShopPart(m.part)}
                  className="btn btn-secondary shrink-0 px-3 py-1.5 text-xs"
                >
                  <ShoppingCart size={13} /> Shop
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex justify-end border-t bg-slate-50 px-6 py-4">
        <button type="button" onClick={onClose} className="btn btn-ghost px-4 py-2 text-sm">Close</button>
      </div>
    </Modal>
  )
}
