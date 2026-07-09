import { useEffect, useState } from 'react'
import { AlertTriangle, ShieldCheck, Gauge, ShoppingCart } from 'lucide-react'
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
  const [mileageInput, setMileageInput] = useState(vehicle.mileage != null ? String(vehicle.mileage) : '')

  useEffect(() => {
    if (recalls !== null) return // session cache hit
    let cancelled = false
    fetchRecalls(vehicle.year, vehicle.make, vehicle.model)
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
    }
  }, [recalls, vehicle.year, vehicle.make, vehicle.model])

  const commitMileage = () => {
    const parsed = Number(mileageInput.replace(/[^0-9]/g, ''))
    onUpdateMileage(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined)
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
              type="text"
              inputMode="numeric"
              value={mileageInput}
              onChange={(e) => setMileageInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
              onBlur={commitMileage}
              placeholder="e.g. 84000"
              aria-label="Current mileage"
              className="field font-data w-28 px-3 py-1.5 text-sm"
            />
          </label>
        </div>
        {vehicle.vin && (
          <p className="font-data mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">VIN · {vehicle.vin}</p>
        )}
      </div>

      <div className="space-y-8 p-6">
        <section>
          <h3 className="section-title text-lg">Open recalls</h3>
          <p className="mt-0.5 text-xs text-slate-500">Live from the NHTSA recall database</p>

          {recallsError ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0" />
              Couldn't reach the NHTSA recall database — try again later.
            </p>
          ) : recalls === null ? (
            <div className="mt-4 flex items-center gap-2.5 text-sm text-slate-500" role="status">
              <RadarMark className="h-5 w-5 text-brand-600 dark:text-brand-400" /> Checking NHTSA…
            </div>
          ) : recalls.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              <ShieldCheck size={15} className="shrink-0" />
              No open recalls found in the NHTSA database
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recalls.map((r, i) => (
                <li key={r.campaignNumber ?? i} className="rounded-xl border border-rose-100 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-rose-600 text-white">Recall</span>
                    {r.campaignNumber && (
                      <span className="font-data text-[11px] font-semibold uppercase tracking-[0.1em] text-rose-700">
                        {r.campaignNumber}
                      </span>
                    )}
                    {r.reportedDate && <span className="text-[11px] text-slate-400">{r.reportedDate}</span>}
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
