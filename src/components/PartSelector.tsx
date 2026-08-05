import { useState } from 'react'
import { Zap, AlertTriangle, Search, ArrowRight, Wrench, ExternalLink, Camera, Image as ImageIcon, CheckCircle2 } from 'lucide-react'
import type { Car } from './CarSelector'
import { Combobox } from './Combobox'
import { partTypesForVehicle, popularPartTypesForVehicle } from '../data/partTypes'
import { isElectricVehicle } from '../data/electricVehicles'
import { diagnoseProblem, fetchQuote, identifyPartFromImage, type DiagnosisMatch, type QuoteResponse } from '../api/client'
import { maintenanceKitsForVehicle } from '../data/maintenanceKits'
import { MAX_PART_QUERY_LENGTH } from '../lib/searchInput.js'
import { classifyDtc } from '../lib/dtcValidation.js'

// Phone camera photos are routinely 3-8MB raw, but the AI model only needs
// enough resolution to recognize a part, and the request has to fit under
// Vercel's ~4.5MB serverless body limit regardless of server-side config.
// Downscale to a max dimension and re-encode as JPEG before ever sending it.
const MAX_PHOTO_DIMENSION = 1024
const PHOTO_JPEG_QUALITY = 0.82

function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas is not supported in this browser'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY))
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read that image'))
    }
    img.src = objectUrl
  })
}

// Honest, human-readable confidence bands for a diagnosis match. Deliberately
// hedged ("Likely"/"Possible") — these are common-cause suggestions, never a
// definitive diagnosis.
const CONFIDENCE_LABELS: Record<'strong' | 'likely' | 'possible', string> = {
  strong: 'Strong match',
  likely: 'Likely match',
  possible: 'Possible match',
}
const CONFIDENCE_STYLES: Record<'strong' | 'likely' | 'possible', string> = {
  strong: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400',
  likely: 'bg-brand-100 text-brand-800 dark:bg-brand-950/30 dark:text-brand-400',
  possible: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

// Follow-up clarifiers. "When does it happen?" is the single most
// disambiguating axis for a car symptom (a grinding noise means very
// different things braking vs. turning vs. accelerating). Selecting one
// appends context to the description and re-runs the same matcher — a real
// follow-up question without having to annotate all 140 knowledge-base
// entries.
const WHEN_CONTEXTS: { label: string; append: string }[] = [
  { label: 'When braking', append: 'when braking' },
  { label: 'When turning', append: 'when turning the steering wheel' },
  { label: 'While accelerating', append: 'while accelerating' },
  { label: 'At idle / stopped', append: 'at idle when stopped' },
  { label: 'At highway speed', append: 'at highway speed' },
  { label: 'When starting', append: 'when starting the car' },
]

const SYMPTOM_EXAMPLES = [
  'Grinding noise when I press the brake pedal',
  "Car won't start, just rapid clicking",
  'Squealing from the engine on cold mornings',
  'Clunking over bumps and potholes',
]

type SearchMethod = 'name' | 'kits' | 'code' | 'photo' | 'symptom'

const SEARCH_METHODS: { id: SearchMethod; label: string }[] = [
  { id: 'name', label: 'Part Name' },
  { id: 'kits', label: 'Maintenance Kits' },
  { id: 'code', label: 'Error Code (OBD-II)' },
  { id: 'photo', label: 'Photo Search' },
  { id: 'symptom', label: 'Describe a Problem' },
]

const COMMON_DTCs: Record<string, { definition: string; parts: string[]; description: string }> = {
  'P0300': {
    definition: 'Random/Multiple Cylinder Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Ignition Wires'],
    description: 'The engine control module detected misfires across multiple cylinders. Ignition, fuel, air, compression, and wiring checks may be required before replacing parts.'
  },
  'P0301': {
    definition: 'Cylinder 1 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire detected on Cylinder 1. Inspect ignition, fuel delivery, wiring, and compression before replacing parts.'
  },
  'P0302': {
    definition: 'Cylinder 2 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire detected on Cylinder 2. Inspect ignition, fuel delivery, wiring, and compression before replacing parts.'
  },
  'P0303': {
    definition: 'Cylinder 3 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire detected on Cylinder 3. Inspect ignition, fuel delivery, wiring, and compression before replacing parts.'
  },
  'P0304': {
    definition: 'Cylinder 4 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire detected on Cylinder 4. Inspect ignition, fuel delivery, wiring, and compression before replacing parts.'
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
    description: 'A small fuel-vapor leak was detected. Inspect the cap, hoses, valves, and related seals before replacing parts.'
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
    description: 'MAF sensor signal frequency or voltage is lower than expected. Inspect the intake path, connector, wiring, and sensor before replacement.'
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
  const [searchMethod, setSearchMethod] = useState<SearchMethod>('name')
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
  // Active follow-up clarifier ("When braking", …), appended to the base
  // description to refine the match. null = no refinement applied.
  const [refineContext, setRefineContext] = useState<{ label: string; append: string } | null>(null)

  // Photo Search state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoScanning, setPhotoScanning] = useState(false)
  const [photoResult, setPhotoResult] = useState<{ identified: boolean; partName: string | null } | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

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

  // Fresh diagnosis from the textarea/examples — drops any active refinement.
  const submitDiagnosis = (text: string) => {
    setRefineContext(null)
    runDiagnosis(text)
  }

  // Apply a follow-up clarifier: re-run the matcher with the context appended
  // to the base description (e.g. "grinding noise" + "when braking").
  const applyRefinement = (ctx: { label: string; append: string }) => {
    setRefineContext(ctx)
    runDiagnosis(`${symptomText} ${ctx.append}`.trim())
  }

  const clearRefinement = () => {
    setRefineContext(null)
    runDiagnosis(symptomText)
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

  // A follow-up "When does it happen?" prompt. Rendered when the match is
  // absent or not yet strong, so a vague description can be sharpened.
  const clarifier = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
        When does it happen?{' '}
        <span className="font-normal text-slate-400">— optional, sharpens the match</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {WHEN_CONTEXTS.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={diagnosing || !symptomText.trim()}
            onClick={() => applyRefinement(c)}
            className={`chip text-[11px] disabled:opacity-40 ${
              refineContext?.label === c.label ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400' : ''
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {refineContext && (
        <button
          type="button"
          onClick={clearRefinement}
          className="mt-2 text-[11px] font-medium text-slate-500 transition hover:text-brand-600"
        >
          Clear “{refineContext.label}” ✕
        </button>
      )}
    </div>
  )

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
  const availableMaintenanceKits = maintenanceKitsForVehicle(electric)

  const handleSearchMethodKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = SEARCH_METHODS.findIndex((method) => method.id === searchMethod)
    let nextIndex = currentIndex
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % SEARCH_METHODS.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + SEARCH_METHODS.length) % SEARCH_METHODS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = SEARCH_METHODS.length - 1
    else return

    event.preventDefault()
    const nextMethod = SEARCH_METHODS[nextIndex]
    setSearchMethod(nextMethod.id)
    window.requestAnimationFrame(() => document.getElementById(`part-tab-${nextMethod.id}`)?.focus())
  }

  const analyzePhoto = async (base64: string) => {
    setPhotoResult(null)
    setPhotoError(null)
    setPhotoScanning(true)
    try {
      setPhotoResult(await identifyPartFromImage(base64))
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to analyze image')
    } finally {
      setPhotoScanning(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset state
    try {
      // Downscale/re-encode first: phone photos are routinely several MB,
      // which both exceeds sane request sizes and slows the AI call for no
      // benefit — the model doesn't need full resolution to name a part.
      const base64 = await downscaleImage(file)
      setPhotoPreview(base64)
      await analyzePhoto(base64)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Failed to analyze image')
    }
  }

  // Find dynamic lookup code match
  const dtcState = classifyDtc(dtcInput, COMMON_DTCs)
  const codeKey = dtcState.code
  const matchedDtc = dtcState.status === 'recognized' ? COMMON_DTCs[codeKey] : null
  const dtcInvalid = dtcState.status === 'invalid'
  const dtcUnknown = dtcState.status === 'unknown'
  const dtcHasProblem = dtcInvalid || dtcUnknown

  return (
    <div className="card min-w-0 max-w-full overflow-hidden p-5 sm:p-7">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-title">What part do you need?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Showing parts for{' '}
            <span className="font-medium text-slate-800">
              {car.year} {car.make} {car.model}
              {car.trim && ` ${car.trim}`}
            </span>
          </p>
        </div>
        <button type="button" onClick={onBack} className="btn btn-ghost shrink-0 px-3 py-1.5 text-sm">
          Change vehicle
        </button>
      </div>

      {electric && (
        <p className="mt-4 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
          <Zap size={14} /> Electric vehicle detected — engine-only parts are hidden.
        </p>
      )}

      {/* Switcher Tab — horizontally scrollable on phones so all five fit */}
      <div className="relative -mx-7 mb-5 mt-6 sm:mx-0">
        <div
          className="flex snap-x overflow-x-auto scrollbar-none border-b border-slate-100 px-7 pr-12 dark:border-slate-800/60 sm:mx-0 sm:px-0 sm:pr-0"
          role="tablist"
          aria-label="Part search method"
          aria-orientation="horizontal"
        >
        {SEARCH_METHODS.map((method) => (
          <button
            key={method.id}
            id={`part-tab-${method.id}`}
            type="button"
            onClick={() => setSearchMethod(method.id)}
            onKeyDown={handleSearchMethodKeyDown}
            className={`tab snap-start ${searchMethod === method.id ? 'tab-active' : ''}`}
            role="tab"
            aria-selected={searchMethod === method.id}
            aria-controls={`part-panel-${method.id}`}
            tabIndex={searchMethod === method.id ? 0 : -1}
          >
            {method.label}
          </button>
        ))}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 flex w-12 items-center justify-end bg-gradient-to-l from-white via-white/95 to-transparent pr-1 dark:from-slate-900 dark:via-slate-900/95">
          <ArrowRight size={14} className="text-slate-400 sm:hidden" />
        </div>
      </div>
      <p className="-mt-3 mb-4 text-[11px] text-slate-500 sm:hidden">Swipe the tabs to see every search method.</p>

      <div
        id={`part-panel-${searchMethod}`}
        role="tabpanel"
        aria-labelledby={`part-tab-${searchMethod}`}
        tabIndex={0}
      >
      {searchMethod === 'symptom' ? (
        <div className="space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitDiagnosis(symptomText)
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
              <div className="-mx-1 flex gap-1.5 overflow-x-auto scrollbar-none px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {SYMPTOM_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setSymptomText(ex)
                      submitDiagnosis(ex)
                    }}
                    className="chip shrink-0 whitespace-nowrap text-[11px]"
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
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              <span>{diagnosisError}</span>
              <button type="button" onClick={() => submitDiagnosis(symptomText)} className="btn btn-secondary btn-sm">
                Retry
              </button>
            </div>
          )}

          {matches !== null && matches.length === 0 && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
                We couldn't match that yet. Add a bit more detail — the{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">sound or symptom</span> and{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">when it happens</span> — or search by part name instead.
              </div>
              {symptomText.trim() && clarifier}
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

              {/* Follow-up: offer to sharpen anything that isn't already a
                  strong, unambiguous match. */}
              {(activeMatch.confidence !== 'strong' || matches.length > 1) && clarifier}

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex items-start gap-2.5">
                  <span className="badge bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400 shrink-0 mt-0.5">{activeMatch.system}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold tracking-tight text-slate-900">{activeMatch.title}</div>
                      <span className={`badge shrink-0 ${CONFIDENCE_STYLES[activeMatch.confidence]}`}>
                        {CONFIDENCE_LABELS[activeMatch.confidence]}
                      </span>
                    </div>
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
                          onChange={(e) => {
                            setCheckedParts((prev) => ({ ...prev, [p.name]: e.target.checked }))
                            // The fetched quote no longer describes the selection.
                            setQuote(null)
                            setQuoteError(null)
                          }}
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
                <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  <span>Couldn't fetch prices: {quoteError}</span>
                  <button type="button" onClick={runQuote} className="btn btn-secondary btn-sm">
                    Retry
                  </button>
                </div>
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
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Lowest delivered price among marketplace compatibility matches. Unknown-fitment listings are excluded.
                    </p>
                  </div>

                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {quote.items.map((item) => (
                      <li key={item.part} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        {item.listing?.image ? (
                          <img src={item.listing.image} alt="" loading="lazy" decoding="async" className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 object-cover" />
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
                              {' · marketplace compatibility match'}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400">No marketplace compatibility matches found right now</p>
                          )}
                        </div>
                        {item.listing && (
                          <div className="shrink-0 text-right">
                            <div className="font-data text-sm font-bold text-slate-900">${item.listing.price.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-400">
                              {item.listing.shippingCost ? `+ $${item.listing.shippingCost.toFixed(2)} ship` : 'Free shipping'}
                            </div>
                          </div>
                        )}
                        <div className="flex w-full gap-2 sm:w-auto sm:shrink-0 sm:flex-col sm:gap-1">
                          <button type="button" onClick={() => onSelect(item.part)} className="btn btn-secondary btn-sm flex-1 whitespace-nowrap sm:flex-none">
                            All listings
                          </button>
                          {item.listing && (
                            <a
                              href={item.listing.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-sm flex-1 justify-center whitespace-nowrap sm:flex-none"
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
                      <div className="font-data text-lg font-bold tracking-tight text-slate-950">
                        ~${quote.total.toFixed(2)}
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                      Estimate only — parts, not labor. Confirm engine, drivetrain, options, and original part number before purchase.
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
              enterKeyHint="search"
              maxLength={MAX_PART_QUERY_LENGTH}
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
      ) : searchMethod === 'kits' ? (
        <div className="animate-fade-in space-y-5">
          <div>
            <label className="field-label">Maintenance kit searches</label>
            <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              Services that require confirmed engine details, such as timing-belt work, are intentionally not suggested here.
            </p>
            <p className="mb-4 text-xs text-slate-500">
              Search for components sold together. If no combined kit is available, we’ll help you search each component separately.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableMaintenanceKits.map((kit) => {
              const Icon = kit.icon
              return (
                <button
                  key={kit.title}
                  type="button"
                  onClick={() => onSelect(kit.search)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kit.background} ${kit.color}`}>
                      <Icon size={22} strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="font-bold tracking-tight text-slate-900 group-hover:text-brand-700">{kit.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{kit.description}</p>
                    </div>
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2">
                    <ArrowRight size={18} className="text-brand-500" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : searchMethod === 'photo' ? (
        <div className="animate-fade-in space-y-5">
          <div className="text-center mb-6">
            <h3 className="section-title">Don't know the part name?</h3>
            <p className="text-sm text-slate-500 mt-1">Take a clear photo and our AI will try to identify the part.</p>
          </div>
          
          {!photoPreview ? (
            <div className="space-y-3">
              <label
                htmlFor="part-photo-input"
                className="group relative flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 transition-all hover:border-brand-300 hover:bg-slate-50 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 dark:border-slate-800 dark:bg-slate-900/30 sm:h-64"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="h-12 w-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Camera size={24} />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-slate-700">Tap to take a photo</p>
                  <p className="text-xs text-slate-400">or upload an existing image</p>
                </div>
                {/* capture="environment" prefers the rear camera on mobile */}
                <input
                  id="part-photo-input"
                  type="file"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  aria-label="Take or upload a photo of the car part"
                  aria-describedby="part-photo-help"
                  onChange={handlePhotoUpload}
                />
              </label>
              <p id="part-photo-help" className="text-center text-[11px] leading-relaxed text-slate-500">
                Use a clear, well-lit photo of the part only. The image is compressed before it is sent for AI identification.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-black/5 dark:border-slate-800 h-64 sm:h-80 w-full flex items-center justify-center">
                <img src={photoPreview} alt="Uploaded part" className="max-h-full object-contain" />
                
                {photoScanning && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10 animate-in fade-in duration-300">
                    <div className="relative h-16 w-16 mb-4">
                      <div className="absolute inset-0 border-4 border-brand-500/30 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                      <ImageIcon className="absolute inset-0 m-auto text-brand-400" size={24} />
                    </div>
                    <div className="font-semibold text-sm tracking-wide">AI is analyzing image...</div>
                  </div>
                )}
              </div>
              
              {photoError && (
                <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3 text-sm text-rose-700">
                  <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                  <div className="flex-1">
                    <div className="font-semibold">Identification Failed</div>
                    <div>{photoError}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => photoPreview && void analyzePhoto(photoPreview)}
                        className="btn btn-secondary btn-sm"
                      >
                        Retry analysis
                      </button>
                      <button type="button" onClick={() => setSearchMethod('name')} className="btn btn-ghost btn-sm">
                        Search by name
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {photoResult && photoResult.identified && photoResult.partName && (
                <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20 animate-fade-in flex flex-col sm:flex-row items-center gap-4 justify-between">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 mb-0.5">Best guess</div>
                      <div className="text-lg font-bold text-slate-900">{photoResult.partName}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(photoResult.partName!)}
                    className="btn btn-primary w-full sm:w-auto whitespace-nowrap"
                  >
                    Find this part <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {photoResult && !photoResult.identified && (
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 animate-fade-in text-center">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Couldn't identify that part</div>
                  <p className="mt-1 text-xs text-slate-500">
                    Try a clearer, well-lit photo of just the part — or search by name instead.
                  </p>
                </div>
              )}
              
              <div className="text-center pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setPhotoPreview(null)
                    setPhotoResult(null)
                    setPhotoError(null)
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors"
                >
                  Try another photo
                </button>
              </div>
            </div>
          )}
        </div>
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
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                 aria-invalid={dtcHasProblem}
                 aria-describedby={dtcHasProblem ? `dtc-help ${dtcUnknown ? 'dtc-unknown' : 'dtc-error'}` : 'dtc-help'}
                className="field pl-9 uppercase"
              />
              <span className="absolute left-3.5 top-3 text-slate-400">
                <Search size={14} />
              </span>
            </div>
            <p id="dtc-help" className="mt-1.5 text-xs text-slate-500">
              A trouble code identifies a detected condition, not a confirmed failed part. Use it to find components commonly inspected.
            </p>
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
                <div className="eyebrow mb-2">Parts commonly inspected for this code</div>
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
          ) : dtcUnknown ? (
            <div id="dtc-unknown" role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              We don't have a verified explanation for <strong>{codeKey}</strong> yet. Confirm the code with the vehicle manufacturer or a qualified technician before buying parts.
            </div>
          ) : (
            dtcInput.trim() && (
              <div id="dtc-error" role="alert" className="py-4 text-center text-xs text-rose-600">
                Invalid OBD-II code format (must match pattern like P0302).
              </div>
            )
          )}
        </div>
      )}
      </div>
    </div>
  )
}
