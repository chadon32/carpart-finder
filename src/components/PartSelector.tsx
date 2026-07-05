import { useState } from 'react'
import { Zap, AlertTriangle, Search, ArrowRight, Wrench, ExternalLink } from 'lucide-react'
import type { Car } from './CarSelector'
import { Combobox } from './Combobox'
import { partTypesForVehicle, popularPartTypesForVehicle } from '../data/partTypes'
import { isElectricVehicle } from '../data/electricVehicles'
import { diagnoseProblem, fetchQuote, type DiagnosisMatch, type QuoteResponse } from '../api/client'

const SYMPTOM_EXAMPLES = [
  'Grinding noise when I press the brake pedal',
  "Car won't start, just rapid clicking",
  'Squealing from the engine on cold mornings',
  'Clunking over bumps and potholes',
]

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
  const [searchMethod, setSearchMethod] = useState<'name' | 'code' | 'symptom'>('name')
  const [dtcInput, setDtcInput] = useState('')

  // "Describe a problem" tab state
  const [symptomText, setSymptomText] = useState('')
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null)
  const [matches, setMatches] = useState<DiagnosisMatch[] | null>(null)
  const [activeMatchIdx, setActiveMatchIdx] = useState(0)
  const [checkedParts, setCheckedParts] = useState<Record<string, boolean>>({})
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const initChecklist = (match: DiagnosisMatch) => {
    const next: Record<string, boolean> = {}
    for (const p of match.parts) next[p.name] = p.priority === 'likely'
    setCheckedParts(next)
  }

  const runDiagnosis = async (text: string) => {
    if (!text.trim() || diagnosing) return
    setDiagnosing(true)
    setDiagnosisError(null)
    setMatches(null)
    setQuote(null)
    setQuoteError(null)
    try {
      const { matches: found } = await diagnoseProblem(text.trim())
      setMatches(found)
      setActiveMatchIdx(0)
      if (found.length > 0) initChecklist(found[0])
    } catch (err) {
      setDiagnosisError(err instanceof Error ? err.message : 'Diagnosis failed')
    } finally {
      setDiagnosing(false)
    }
  }

  const selectMatch = (idx: number) => {
    if (!matches) return
    setActiveMatchIdx(idx)
    initChecklist(matches[idx])
    setQuote(null)
    setQuoteError(null)
  }

  const activeMatch = matches && matches.length > 0 ? matches[activeMatchIdx] : null
  const selectedParts = activeMatch ? activeMatch.parts.filter((p) => checkedParts[p.name]).map((p) => p.name) : []

  const runQuote = async () => {
    if (selectedParts.length === 0 || quoting) return
    setQuoting(true)
    setQuoteError(null)
    setQuote(null)
    try {
      const res = await fetchQuote(car.year, car.make, car.model, selectedParts, car.trim || undefined)
      setQuote(res)
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'Quote failed')
    } finally {
      setQuoting(false)
    }
  }

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
      <div className="mt-6 mb-5 flex border-b border-slate-100 dark:border-slate-800/60">
        <button
          type="button"
          onClick={() => setSearchMethod('name')}
          className={`tab ${searchMethod === 'name' ? 'tab-active' : ''}`}
        >
          Part Name
        </button>
        <button
          type="button"
          onClick={() => setSearchMethod('code')}
          className={`tab ${searchMethod === 'code' ? 'tab-active' : ''}`}
        >
          Error Code (OBD-II)
        </button>
        <button
          type="button"
          onClick={() => setSearchMethod('symptom')}
          className={`tab ${searchMethod === 'symptom' ? 'tab-active' : ''}`}
        >
          Describe a Problem
        </button>
      </div>

      {searchMethod === 'symptom' ? (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              runDiagnosis(symptomText)
            }}
          >
            <label htmlFor="symptom-input" className="field-label">
              What's going on with your {car.make} {car.model}?
            </label>
            <textarea
              id="symptom-input"
              rows={3}
              maxLength={600}
              placeholder='e.g. "Metallic grinding or scraping noise when I press the brake pedal"'
              value={symptomText}
              onChange={(e) => setSymptomText(e.target.value)}
              className="field resize-none"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOM_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setSymptomText(ex)
                      runDiagnosis(ex)
                    }}
                    className="chip text-[11px]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <button type="submit" disabled={!symptomText.trim() || diagnosing} className="btn btn-primary shrink-0">
                <Wrench size={15} />
                {diagnosing ? 'Matching…' : 'Find likely parts'}
              </button>
            </div>
          </form>

          {diagnosisError && (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {diagnosisError}
            </p>
          )}

          {matches !== null && matches.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-500">
              We couldn't match that description to a common cause. Try describing the <span className="font-medium text-slate-700">sound</span> and{' '}
              <span className="font-medium text-slate-700">when it happens</span> (braking, turning, starting…) — or search by part name instead.
            </div>
          )}

          {matches !== null && matches.length > 0 && activeMatch && (
            <div className="animate-fade-in space-y-4">
              {matches.length > 1 && (
                <div>
                  <p className="eyebrow mb-2">Possible causes — pick the closest match</p>
                  <div className="flex flex-wrap gap-1.5">
                    {matches.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMatch(i)}
                        className={`chip ${i === activeMatchIdx ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400' : ''}`}
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex items-start gap-2.5">
                  <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400 shrink-0 mt-0.5">{activeMatch.system}</span>
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-slate-900">{activeMatch.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{activeMatch.summary}</p>
                  </div>
                </div>

                {activeMatch.safety && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    {activeMatch.safety}
                  </p>
                )}

                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/60">
                  <div className="eyebrow mb-2">Parts to price — untick anything you don't need</div>
                  <div className="flex flex-col gap-1.5">
                    {activeMatch.parts.map((p) => (
                      <label
                        key={p.name}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 transition hover:border-slate-300 dark:border-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedParts[p.name]}
                          onChange={(e) => setCheckedParts((prev) => ({ ...prev, [p.name]: e.target.checked }))}
                          className="mt-0.5 h-3.5 w-3.5 accent-brand-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800">{p.name}</span>
                            <span className={`badge px-2 py-px text-[9px] ${p.priority === 'likely' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {p.priority === 'likely' ? 'Most likely' : 'Possible'}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{p.why}</span>
                        </span>
                      </label>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={runQuote}
                    disabled={selectedParts.length === 0 || quoting}
                    className="btn btn-primary mt-4 w-full sm:w-auto"
                  >
                    {quoting
                      ? 'Fetching live prices…'
                      : `Get instant quote (${selectedParts.length} part${selectedParts.length === 1 ? '' : 's'})`}
                    {!quoting && <ArrowRight size={15} />}
                  </button>
                </div>
              </div>

              {quoteError && (
                <p className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  Couldn't fetch prices: {quoteError}
                </p>
              )}

              {quoting && (
                <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 text-center text-xs font-medium text-slate-400 dark:border-slate-800">
                  Searching live eBay listings for {selectedParts.length} part{selectedParts.length === 1 ? '' : 's'} that fit your {car.year} {car.make} {car.model}…
                </div>
              )}

              {quote && (
                <div className="animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800">
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800/60">
                    <div className="text-sm font-semibold tracking-tight text-slate-900">
                      Your quote — {car.year} {car.make} {car.model}
                      {car.trim ? ` ${car.trim}` : ''}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">Cheapest fitting listing per part, live from eBay right now.</p>
                  </div>

                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {quote.items.map((item) => (
                      <li key={item.part} className="flex items-center gap-3 px-4 py-3">
                        {item.listing?.image ? (
                          <img src={item.listing.image} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 object-cover" />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-300 dark:bg-slate-800">
                            <Wrench size={16} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800">{item.part}</div>
                          {item.listing ? (
                            <p className="truncate text-[11px] text-slate-500">
                              {item.listing.condition} · {item.listing.seller} · {item.listing.source}
                              {item.listing.verifiedFitment === false && ' · fitment not verified'}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400">No fitting listings found right now</p>
                          )}
                        </div>
                        {item.listing && (
                          <div className="shrink-0 text-right">
                            <div className="text-sm font-bold text-slate-900">${item.listing.price.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-400">
                              {item.listing.shippingCost ? `+ $${item.listing.shippingCost.toFixed(2)} ship` : 'Free shipping'}
                            </div>
                          </div>
                        )}
                        <div className="flex shrink-0 flex-col gap-1">
                          <button type="button" onClick={() => onSelect(item.part)} className="btn btn-secondary btn-sm whitespace-nowrap">
                            All listings
                          </button>
                          {item.listing && (
                            <a
                              href={item.listing.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm whitespace-nowrap"
                            >
                              View <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="flex items-baseline justify-between">
                      <div className="text-xs text-slate-500">
                        Parts ${quote.subtotal.toFixed(2)} + shipping ${quote.shipping.toFixed(2)}
                      </div>
                      <div className="text-lg font-extrabold tracking-tight text-slate-950">
                        ~${quote.total.toFixed(2)}
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      Estimate only — parts, not labor. Prices are live and change with listings; based on the cheapest option per part.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-[10px] leading-relaxed text-slate-400">
                Based on commonly reported causes for these symptoms — not a professional inspection. When in doubt, have a mechanic confirm before buying parts.
              </p>
            </div>
          )}
        </div>
      ) : searchMethod === 'name' ? (
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
            <p className="eyebrow mb-2.5">Popular parts</p>
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
            <label htmlFor="dtc-input" className="field-label">
              DTC error code
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

              <div className="border-t border-slate-100 pt-3 dark:border-slate-800/60">
                <div className="eyebrow mb-2">Recommended replacement parts</div>
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
