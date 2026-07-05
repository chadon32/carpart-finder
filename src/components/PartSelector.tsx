import { useState } from 'react'
import { Zap, AlertTriangle, Search, ArrowRight } from 'lucide-react'
import type { Car } from './CarSelector'
import { Combobox } from './Combobox'
import { partTypesForVehicle, popularPartTypesForVehicle } from '../data/partTypes'
import { isElectricVehicle } from '../data/electricVehicles'

const COMMON_DTCs: Record<string, { definition: string; parts: string[]; description: string }> = {
  'P0300': {
    definition: 'Random/Multiple Cylinder Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Ignition Wires'],
    description: 'The engine control module has detected misfires across multiple cylinders. Often resolved by changing spark plugs or coils.'
  },
  'P0301': {
    definition: 'Cylinder 1 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire isolated to Cylinder 1. Try replacing spark plugs or swapping coils.'
  },
  'P0302': {
    definition: 'Cylinder 2 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire isolated to Cylinder 2. Try replacing spark plugs or swapping coils.'
  },
  'P0303': {
    definition: 'Cylinder 3 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire isolated to Cylinder 3. Try replacing spark plugs or swapping coils.'
  },
  'P0304': {
    definition: 'Cylinder 4 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire isolated to Cylinder 4. Try replacing spark plugs or swapping coils.'
  },
  'P0171': {
    definition: 'System Too Lean (Bank 1)',
    parts: ['Oxygen Sensor', 'Mass Airflow Sensor', 'Intake Manifold Gasket'],
    description: 'Too much air or not enough fuel in Bank 1. Commonly caused by vacuum leaks or a dirty/faulty MAF sensor.'
  },
  'P0174': {
    definition: 'System Too Lean (Bank 2)',
    parts: ['Oxygen Sensor', 'Mass Airflow Sensor', 'Vacuum Hose'],
    description: 'Too much air or not enough fuel in Bank 2. Commonly caused by vacuum leaks or a dirty/faulty MAF sensor.'
  },
  'P0420': {
    definition: 'Catalyst System Efficiency Below Threshold (Bank 1)',
    parts: ['Catalytic Converter', 'Oxygen Sensor'],
    description: 'The catalytic converter is not operating at peak efficiency. Can also be triggered by a faulty O2 sensor.'
  },
  'P0430': {
    definition: 'Catalyst System Efficiency Below Threshold (Bank 2)',
    parts: ['Catalytic Converter', 'Oxygen Sensor'],
    description: 'The catalytic converter is not operating at peak efficiency. Can also be triggered by a faulty O2 sensor.'
  },
  'P0442': {
    definition: 'EVAP System Leak Detected (Small Leak)',
    parts: ['Gas Cap', 'Vapor Canister Purge Valve', 'EVAP Vent Solenoid'],
    description: 'Small fuel vapor leak. Most commonly resolved by tightening or replacing a worn gas cap.'
  },
  'P0455': {
    definition: 'EVAP System Leak Detected (Large Leak)',
    parts: ['Gas Cap', 'Vapor Canister Purge Valve', 'EVAP Charcoal Canister'],
    description: 'Large fuel vapor leak. Check for loose gas cap, cracked evap hoses, or purge valve failure.'
  },
  'P0115': {
    definition: 'Engine Coolant Temperature Sensor Circuit Malfunction',
    parts: ['Coolant Temperature Sensor', 'Thermostat'],
    description: 'PCM is not receiving correct engine temperature signals. Can cause cooling fans to run constantly.'
  },
  'P0102': {
    definition: 'Mass Air Flow (MAF) Sensor Circuit Low Input',
    parts: ['Mass Airflow Sensor', 'Air Filter'],
    description: 'MAF sensor signal frequency or voltage is lower than normal limits. Try cleaning or replacing the sensor.'
  }
}

export function PartSelector({
  car,
  onSelect,
  onBack,
}: {
  car: Car
  onSelect: (part: string) => void
  onBack: () => void
}) {
  const [searchMethod, setSearchMethod] = useState<'name' | 'code'>('name')
  const [dtcInput, setDtcInput] = useState('')

  const electric = isElectricVehicle(car.make, car.model)
  const partTypes = partTypesForVehicle(electric)
  const popularPartTypes = popularPartTypesForVehicle(electric)

  // Find dynamic lookup code match
  const codeKey = dtcInput.trim().toUpperCase()
  const matchedDtc = COMMON_DTCs[codeKey] || (codeKey.length >= 4 && /^[P]\d{4}$/.test(codeKey) ? {
    definition: `OBD-II Diagnostic Code ${codeKey}`,
    parts: ['Spark Plugs', 'Ignition Coils', 'Oxygen Sensor', 'Mass Airflow Sensor'],
    description: `Trouble code ${codeKey} entered. Select from the matched replacement components below.`
  } : null)

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
          <Zap size={14} /> Electric vehicle detected — engine-only parts are hidden.
        </p>
      )}

      {/* Switcher Tab */}
      <div className="mt-6 flex border-b border-slate-100 mb-5">
        <button
          type="button"
          onClick={() => setSearchMethod('name')}
          className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition ${
            searchMethod === 'name'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Search by Part Name
        </button>
        <button
          type="button"
          onClick={() => setSearchMethod('code')}
          className={`flex-1 pb-2.5 text-xs font-bold text-center border-b-2 transition ${
            searchMethod === 'code'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Search by Error Code (OBD-II)
        </button>
      </div>

      {searchMethod === 'name' ? (
        <>
          <div>
            <Combobox
              label="Part search"
              placeholder="Search by part name or OEM number (e.g. Brake Rotors, 04465-0K010)"
              options={partTypes.map((p) => p.name)}
              value=""
              onChange={(part) => onSelect(part)}
              allowFreeText
            />
            <p className="mt-1.5 text-xs text-slate-500">Pick from the autocomplete list, or enter any custom part name or number and press Enter.</p>
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
        </>
      ) : (
        <div className="space-y-5">
          <div>
            <label htmlFor="dtc-input" className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
              DTC Error Code
            </label>
            <div className="relative">
              <input
                id="dtc-input"
                type="text"
                placeholder="Enter OBD-II trouble code (e.g., P0302, P0171)"
                value={dtcInput}
                onChange={(e) => setDtcInput(e.target.value)}
                className="field pl-9 uppercase"
              />
              <span className="absolute left-3.5 top-3 text-slate-400">
                <Search size={14} />
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Enter a diagnostic error code from your dashboard scanner to see recommended parts.</p>
          </div>

          {matchedDtc ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4 space-y-3 animate-fade-in">
              <div className="flex items-start gap-2.5 text-slate-800">
                <span className="mt-0.5 shrink-0 text-brand-500">
                  <AlertTriangle size={15} />
                </span>
                <div>
                  <div className="font-extrabold text-slate-900 text-sm tracking-tight">{matchedDtc.definition}</div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{matchedDtc.description}</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recommended Replacement Parts</div>
                <div className="flex flex-col gap-1.5">
                  {matchedDtc.parts.map((partName) => (
                    <button
                      key={partName}
                      type="button"
                      onClick={() => onSelect(partName)}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 hover:border-brand-500 hover:bg-brand-50/10 text-xs font-semibold text-slate-700 transition-all text-left"
                    >
                      <span>Find {partName}</span>
                      <ArrowRight size={13} className="text-slate-400 group-hover:text-brand-500" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            dtcInput.trim() && (
              <div className="text-center py-4 text-xs text-slate-400">
                Invalid OBD-II code format (must match pattern like P0302).
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
