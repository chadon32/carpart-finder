import { useEffect, useState } from 'react'
import { Loader2, RotateCw, Sparkles, Wrench, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Listing } from '../api/client'
import type { Car } from './CarSelector'
import { Modal } from './Modal'
import { trackAIGenerated } from '../lib/analytics'
import { readJsonResponse } from '../lib/apiErrors.js'

interface RepairGuideModalProps {
  vehicle: Car
  listing: Listing
  part: string
  onClose: () => void
}

export function RepairGuideModal({ vehicle, listing, part, onClose }: RepairGuideModalProps) {
  const [guide, setGuide] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [guideError, setGuideError] = useState<string | null>(null)
  const [takingLong, setTakingLong] = useState(false)
  const [generationAttempt, setGenerationAttempt] = useState(0)
  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setTakingLong(true)
    }, 15000)

    const generateGuide = async () => {
      setIsGenerating(true)
      setTakingLong(false)
      setGuide(null)
      setGuideError(null)

      try {
        const res = await fetch('/api/ai/repair-guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim || '',
            part,
            listingId: listing.id,
            source: listing.source,
            fitmentProof: listing.fitmentProof,
          }),
          signal: controller.signal,
        })

        const data = await readJsonResponse<{ guide?: string }>(res, '/api/ai/repair-guide')
        if (!cancelled) {
          setGuide(data.guide || '')
          trackAIGenerated(part, vehicleLabel)
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!cancelled) setGuideError(err instanceof Error ? err.message : 'The guide could not be generated.')
      } finally {
        window.clearTimeout(slowTimer)
        if (!cancelled) setIsGenerating(false)
      }
    }

    void generateGuide()

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
      controller.abort()
    }
  }, [
    generationAttempt,
    listing.fitmentProof,
    listing.id,
    listing.source,
    part,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.year,
    vehicleLabel,
  ])

  return (
    <Modal label={`AI Repair Guide for ${part}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex items-center justify-between rounded-t-2xl border-b bg-slate-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600 shadow-inner">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="section-title text-lg sm:text-xl">AI Repair Guide</h2>
            <p className="text-xs text-slate-500">{vehicleLabel} • {part}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700">
          <X size={20} />
        </button>
      </div>

      <div className="min-h-[50vh] p-6 md:p-8">
        {isGenerating && (
          <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 size={32} className="mb-4 animate-spin text-brand-500" />
            <p className="text-base font-medium text-slate-700">Gemini is writing your repair guide...</p>
            <p className="mt-2 text-sm text-slate-400">Preparing a cautious overview for {vehicleLabel}</p>
            <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-slate-500">
              {takingLong
                ? 'Still working. You can close this window to cancel and try again later.'
                : 'This usually takes 20–30 seconds. Closing this window cancels the request.'}
            </p>
          </div>
        )}

        {guideError && (
          <div role="alert" className="flex flex-col items-center justify-center py-12 text-center text-rose-700">
            <Wrench size={32} className="mb-4 text-rose-400" />
            <p className="text-lg font-medium">Failed to generate guide</p>
            <p className="mt-2 max-w-lg text-sm">{guideError}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setGenerationAttempt((attempt) => attempt + 1)}
                className="btn btn-primary px-4 py-2"
              >
                <RotateCw size={15} /> Retry
              </button>
              <button type="button" onClick={onClose} className="btn btn-secondary px-4 py-2">
                Close
              </button>
            </div>
          </div>
        )}

        {guide && (
          <div className="prose prose-slate max-w-none text-slate-700 prose-headings:font-bold prose-h1:text-2xl prose-h2:mt-8 prose-h2:border-b prose-h2:pb-2 prose-h2:text-xl prose-li:my-1">
            <ReactMarkdown>{guide}</ReactMarkdown>
          </div>
        )}
      </div>

      {!isGenerating && !guideError && (
        <div className="flex items-center justify-between rounded-b-2xl border-t bg-slate-50 px-6 py-4">
          <p className="text-xs text-slate-400">
            AI overview only. Confirm the exact procedure and specifications in the manufacturer service manual.
          </p>
          <button type="button" onClick={onClose} className="btn btn-secondary ml-4 shrink-0 px-4 py-2">
            Close Guide
          </button>
        </div>
      )}
    </Modal>
  )
}
