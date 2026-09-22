import { FriendlyApiError, friendlyApiError, readJsonResponse } from '../lib/apiErrors.js'
import { assertFitmentContract } from '../../shared/apiContract.js'
import { isRecallList, type Recall } from '../../shared/recalls.js'
export type { Recall } from '../../shared/recalls.js'

export type Listing = {
  id: string
  title: string
  price: number
  currency: string
  condition: string
  seller: string
  sellerFeedbackPercentage: string | null
  sellerFeedbackScore?: number | null
  image: string | null
  link: string
  source: string
  crossBorder: boolean
  shipsFrom?: string
  estimatedDelivery?: string
  originalPrice?: number | null
  discountPercentage?: string | null
  itemLocation?: string | null
  topRatedSeller?: boolean
  bestOfferAccepted?: boolean
  shortDescription?: string | null
  shippingCost?: number | null
  deliveryMin?: string | null
  deliveryMax?: string | null
  // True only when the provider returned explicit exact compatibility evidence.
  // Missing/false is always unverified and must never render as a guarantee.
  verifiedFitment?: boolean
  fitmentTier?: 'verified' | 'fallback'
  fitmentProof?: string | null
  fitmentEvidence?: {
    provider: string
    matchType: 'EXACT' | null
    scope: 'year-make-model' | 'year-make-model-trim' | 'keyword-only'
    matchedVehicle: {
      year: string
      make: string
      model: string
      trim?: string
    } | null
    checkedAt: string
    note: string
  }
}

export type SearchResponse = {
  fitmentContractVersion: 2
  query: string
  // Primary results contain only structured provider compatibility matches.
  results: Listing[]
  // Broad marketplace candidates are kept separate and are never ranked or
  // automatically selected as fitting choices.
  fallbackResults?: Listing[]
  fitmentSummary?: { verified: number; fallback: number; hiddenIrrelevantFallbacks?: number }
  providerErrors: Record<string, string>
  skippedProviders: string[]
  cached?: boolean
  // True when live search failed and these are recent last-known-good results.
  stale?: boolean
}

const DEFAULT_TIMEOUT_MS = 20_000
const SEARCH_TIMEOUT_MS = 45_000
const AI_TIMEOUT_MS = 45_000

async function requestJson<T>(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const callerSignal = init.signal
  let timedOut = false
  const timeout = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortFromCaller = () => controller.abort()
  if (callerSignal?.aborted) controller.abort()
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return await readJsonResponse<T>(res, url)
  } catch (error) {
    if (timedOut) {
      throw new FriendlyApiError(`The ${url.includes('/search') || url.includes('/quote') ? 'price search' : 'request'} timed out. Check your connection and try again.`, 408)
    }
    if (error instanceof Error && error.name === 'AbortError') throw error
    if (error instanceof FriendlyApiError) throw error
    throw new FriendlyApiError(friendlyApiError(url, 0), 0)
  } finally {
    window.clearTimeout(timeout)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}

async function getJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS, signal?: AbortSignal): Promise<T> {
  return requestJson(url, { signal }, timeoutMs)
}

export type VehicleType = 'all' | 'car' | 'suv' | 'truck'

export function fetchMakes(type: VehicleType = 'all'): Promise<{ makes: string[] }> {
  const params = type === 'all' ? '' : `?${new URLSearchParams({ type }).toString()}`
  return getJson(`/api/makes${params}`)
}

export function fetchModels(make: string, year: string): Promise<{ models: string[] }> {
  const params = new URLSearchParams({ make, year })
  return getJson(`/api/models?${params.toString()}`)
}

export function fetchTrims(year: string, make: string, model: string): Promise<{ trims: string[] }> {
  const params = new URLSearchParams({ year, make, model })
  return getJson(`/api/trims?${params.toString()}`)
}

export function fetchVehicleImage(make: string, model: string, year?: string): Promise<{ imageUrl: string | null }> {
  const params = new URLSearchParams({ make, model, v: '2' })
  if (year) params.set('year', year)
  return getJson(`/api/vehicle-image?${params.toString()}`)
}

export type PriceInfo = { available: boolean; price?: number | null }

export function fetchPrices(ids: string[]): Promise<{ prices: Record<string, PriceInfo> }> {
  const params = new URLSearchParams({ ids: ids.join(',') })
  return getJson(`/api/prices?${params.toString()}`)
}

// The API validates query length, so a large watchlist must not go out as one
// giant ids param. Batches of 10 in parallel; partial failures contribute
// nothing, and only an all-batches failure rejects (so callers can still
// surface a real outage).
export async function fetchPricesChunked(ids: string[]): Promise<Record<string, PriceInfo>> {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += 10) batches.push(ids.slice(i, i + 10))
  const settled = await Promise.allSettled(batches.map((b) => fetchPrices(b)))
  const merged: Record<string, PriceInfo> = {}
  let anyFulfilled = false
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      anyFulfilled = true
      Object.assign(merged, s.value.prices)
    }
  }
  if (!anyFulfilled && batches.length > 0) {
    const firstFailure = settled[0] as PromiseRejectedResult
    throw firstFailure.reason
  }
  return merged
}

export type SymptomPart = {
  name: string
  why: string
  priority: 'likely' | 'possible'
}

export type DiagnosisMatch = {
  id: string
  title: string
  system: string
  summary: string
  safety: string | null
  score: number
  confidence: 'strong' | 'likely' | 'possible'
  parts: SymptomPart[]
}

export function diagnoseProblem(symptom: string): Promise<{ matches: DiagnosisMatch[] }> {
  const params = new URLSearchParams({ symptom })
  return getJson(`/api/diagnose?${params.toString()}`)
}

export type QuoteItem = {
  part: string
  listing: Listing | null
  error?: boolean
}

export type QuoteResponse = {
  fitmentContractVersion: 2
  items: QuoteItem[]
  subtotal: number
  shipping: number
  total: number
  currency: string
}

export async function fetchQuote(
  year: string,
  make: string,
  model: string,
  parts: string[],
  trim?: string,
  zip?: string
): Promise<QuoteResponse> {
  const params = new URLSearchParams({ year, make, model, parts: parts.join(',') })
  if (trim) params.set('trim', trim)
  if (zip) params.set('zip', zip)
  const response = await getJson<QuoteResponse>(`/api/quote?${params.toString()}`, SEARCH_TIMEOUT_MS)
  return assertFitmentContract(response)
}

export async function searchParts(
  year: string,
  make: string,
  model: string,
  part: string,
  trim?: string,
  zip?: string,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const params = new URLSearchParams({ year, make, model, part })
  if (trim) params.set('trim', trim)
  if (zip) params.set('zip', zip)
  const response = await getJson<SearchResponse>(`/api/search?${params.toString()}`, SEARCH_TIMEOUT_MS, signal)
  return assertFitmentContract(response)
}

export type ApiHealth = {
  status: 'ok'
  apiRelease: string
  buildId: string
  fitmentContractVersion: 2
}

export async function fetchApiHealth(): Promise<ApiHealth> {
  const response = await getJson<ApiHealth>('/api/health')
  return assertFitmentContract(response)
}

export type PriceObservation = { date: string; price: number }

export function fetchPriceHistory(
  year: string,
  make: string,
  model: string,
  part: string,
  signal?: AbortSignal
): Promise<{ observations: PriceObservation[] }> {
  const params = new URLSearchParams({ year, make, model, part })
  return getJson(`/api/price-history?${params.toString()}`, DEFAULT_TIMEOUT_MS, signal)
}

export async function fetchRecalls(year: string, make: string, model: string, signal?: AbortSignal): Promise<{ recalls: Recall[] }> {
  const params = new URLSearchParams({ year, make, model })
  const data = await getJson<{ recalls: unknown }>(`/api/recalls?${params.toString()}`, DEFAULT_TIMEOUT_MS, signal)
  if (!isRecallList(data?.recalls)) throw new FriendlyApiError('Recall data was unreadable. Please try again.', 502)
  return { recalls: data.recalls }
}

export type VinDecodeResult = {
  year: string
  make: string
  model: string
  trim: string | null
  engine: {
    displacementL: string | null
    cylinders: string | null
    driveType: string | null
    fuelType: string | null
  }
}

export function decodeVinApi(vin: string): Promise<VinDecodeResult> {
  const params = new URLSearchParams({ vin })
  return getJson(`/api/vin?${params.toString()}`)
}

export async function identifyPartFromImage(base64Image: string): Promise<{ identified: boolean; partName: string | null }> {
  const data = await requestJson<{ identified?: unknown; partName?: unknown }>('/api/identify-part', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  }, AI_TIMEOUT_MS)
  if (typeof data.identified !== 'boolean') {
    throw new FriendlyApiError('The photo identifier returned an unreadable response. Please try again.', 502)
  }
  if (data.partName !== null && data.partName !== undefined && typeof data.partName !== 'string') {
    throw new FriendlyApiError('The photo identifier returned an unreadable response. Please try again.', 502)
  }
  return {
    identified: data.identified,
    partName: data.identified && typeof data.partName === 'string' ? data.partName : null,
  }
}
