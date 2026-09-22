import type { Listing, SearchResponse, VehicleType, VinDecodeResult } from './types'
import { isRecallList, type Recall } from '../../../shared/recalls.js'
export type { Recall } from '../../../shared/recalls.js'

const configuredApiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
export const API_BASE = (configuredApiBase || 'https://carpartsradar.com').replace(/\/+$/, '')
const FITMENT_CONTRACT_VERSION = 2
const DEFAULT_TIMEOUT_MS = 20_000
const SEARCH_TIMEOUT_MS = 45_000
const AI_TIMEOUT_MS = 45_000
const MAX_GUIDE_LENGTH = 12_000

function assertFitmentContract<T extends { fitmentContractVersion?: number }>(payload: T): T {
  if (payload.fitmentContractVersion !== FITMENT_CONTRACT_VERSION) {
    throw new Error('The search service is out of date. Update the app or try again later.')
  }
  return payload
}

// credentials 'include': auth rides the same httpOnly cpf_token cookie the
// website uses — iOS persists it natively, so app and site share accounts.
// Thrown for non-OK responses; carries the HTTP status so callers can tell
// "you are signed out" (401) apart from "the network hiccuped".
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  timeoutMs?: number
  signal?: AbortSignal
  timeoutMessage?: string
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const abortFromCaller = () => controller.abort()
  if (options.signal?.aborted) controller.abort()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method,
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        'X-App-Platform': 'ios',
      },
      credentials: 'include',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: controller.signal,
    })

    let data: unknown
    try {
      data = await res.json()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      throw new ApiError('The service returned an unreadable response. Please try again.', res.status)
    }
    if (!res.ok) {
      throw new ApiError(
        (data as { error?: string }).error || `Request failed (${res.status})`,
        res.status
      )
    }
    return data as T
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError' && timedOut) {
      throw new TypeError(options.timeoutMessage || 'The request timed out. Check your connection and try again.')
    }
    if (error instanceof Error && error.name === 'AbortError') throw error
    if (error instanceof ApiError) throw error
    throw new ApiError('Could not reach CarPartsRadar. Check your connection and try again.', 0)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}

async function getJson<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS, signal?: AbortSignal): Promise<T> {
  return requestJson(path, { timeoutMs, signal })
}

async function postJson<T>(path: string, body: unknown, method = 'POST', timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return requestJson(path, { method, body, timeoutMs })
}

export function fetchMakes(type: VehicleType = 'all'): Promise<{ makes: string[] }> {
  const params = type === 'all' ? '' : `?${new URLSearchParams({ type })}`
  return getJson(`/api/makes${params}`)
}

export function fetchModels(make: string, year: string): Promise<{ models: string[] }> {
  return getJson(`/api/models?${new URLSearchParams({ make, year })}`)
}

export function fetchTrims(year: string, make: string, model: string): Promise<{ trims: string[] }> {
  return getJson(`/api/trims?${new URLSearchParams({ year, make, model })}`)
}

export function fetchVehicleImage(
  make: string,
  model: string,
  year?: string
): Promise<{ imageUrl: string | null }> {
  const params = new URLSearchParams({ make, model, v: '2' })
  if (year) params.set('year', year)
  return getJson(`/api/vehicle-image?${params}`)
}

export type PriceInfo = { available: boolean; price?: number | null }

export function fetchPrices(ids: string[]): Promise<{ prices: Record<string, PriceInfo> }> {
  return getJson(`/api/prices?${new URLSearchParams({ ids: ids.join(',') })}`)
}

// The API validates query length, so an unbounded watchlist must not go out
// as one giant ids param. Batches of 10, in parallel; a failed batch
// contributes nothing (its items honestly show no live quote).
export async function fetchPricesChunked(ids: string[]): Promise<Record<string, PriceInfo>> {
  const batches: string[][] = []
  for (let i = 0; i < ids.length; i += 10) batches.push(ids.slice(i, i + 10))
  const settled = await Promise.allSettled(batches.map((b) => fetchPrices(b)))
  const merged: Record<string, PriceInfo> = {}
  for (const s of settled) {
    if (s.status === 'fulfilled') Object.assign(merged, s.value.prices)
  }
  return merged
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
  const response = await getJson<SearchResponse>(`/api/search?${params}`, SEARCH_TIMEOUT_MS, signal)
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
  return getJson(`/api/price-history?${new URLSearchParams({ year, make, model, part })}`, DEFAULT_TIMEOUT_MS, signal)
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
  const response = await getJson<QuoteResponse>(`/api/quote?${params}`, SEARCH_TIMEOUT_MS)
  return assertFitmentContract(response)
}

export function decodeVinApi(vin: string): Promise<VinDecodeResult> {
  return getJson(`/api/vin?${new URLSearchParams({ vin })}`)
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
  return getJson(`/api/diagnose?${new URLSearchParams({ symptom })}`)
}

export async function fetchRecalls(year: string, make: string, model: string, signal?: AbortSignal): Promise<{ recalls: Recall[] }> {
  const data = await getJson<{ recalls: unknown }>(`/api/recalls?${new URLSearchParams({ year, make, model })}`, DEFAULT_TIMEOUT_MS, signal)
  if (!isRecallList(data?.recalls)) throw new ApiError('Recall data was unreadable. Please try again.', 502)
  return { recalls: data.recalls }
}

export type RepairGuideRequest = {
  year: string
  make: string
  model: string
  trim?: string
  part: string
  listingId: string
  source: string
  fitmentProof: string
}

export async function fetchRepairGuide(
  request: RepairGuideRequest,
  signal?: AbortSignal
): Promise<{ guide: string }> {
  const data = await requestJson<{ guide?: unknown }>('/api/ai/repair-guide', {
    method: 'POST',
    body: request,
    signal,
    timeoutMs: AI_TIMEOUT_MS,
    timeoutMessage: 'The repair guide timed out. Please try again.',
  })
  if (typeof data.guide !== 'string' || !data.guide.trim() || data.guide.length > MAX_GUIDE_LENGTH) {
    throw new ApiError('The repair guide response was incomplete. Please try again.', 502)
  }
  return { guide: data.guide }
}

// ---- Accounts (shared with the website via the same API + cookie) ----

export type AuthUser = {
  id: string
  email?: string
  user_metadata?: { full_name?: string }
}

export type AuthResponse = { user: AuthUser; confirmationRequired?: boolean }

export function login(email: string, password: string): Promise<AuthResponse> {
  return postJson('/api/supabase/login', { email, password })
}

export function signup(email: string, password: string, name?: string): Promise<AuthResponse> {
  return postJson('/api/supabase/signup', { email, password, name })
}

export function logout(): Promise<{ success?: boolean }> {
  return postJson('/api/supabase/logout', {})
}

export type AccountDeletionResponse = { success: boolean; alreadyDeleted?: boolean }

export type AccountDeletionIntentResponse = { receipt: string; expiresInMs: number }
export type AccountDeletionStatusResponse = { success: boolean; deleted: boolean }

export function prepareAccountDeletion(confirmation: string): Promise<AccountDeletionIntentResponse> {
  return postJson('/api/supabase/account/deletion-intent', { confirmation })
}

export function getAccountDeletionStatus(receipt: string): Promise<AccountDeletionStatusResponse> {
  return postJson('/api/supabase/account/deletion-status', { receipt }, 'POST', 10_000)
}

export function deleteAccount(
  confirmation: string,
  receipt?: string
): Promise<AccountDeletionResponse> {
  // The server enforces a 20-second deletion timeout. Give it a small network
  // margin, then surface an actionable timeout instead of leaving the screen
  // busy indefinitely on a broken connection.
  return postJson('/api/supabase/account', { confirmation, ...(receipt ? { receipt } : {}) }, 'DELETE', 25_000)
}

export function getMe(): Promise<{ user: AuthUser }> {
  return getJson('/api/supabase/me')
}

export type SavedSearch = {
  id: string
  year: string
  make: string
  model: string
  trim: string | null
  part: string
  created_at: string
}

export type PriceAlert = {
  id: string
  saved_search_id: string
  target_price: number
  is_active: boolean
  created_at: string
  saved_searches: SavedSearch | null
}

export function createSavedSearch(
  year: string,
  make: string,
  model: string,
  trim: string,
  part: string
): Promise<{ search: SavedSearch }> {
  return postJson('/api/supabase/saved-searches', { year, make, model, trim, part })
}

export function deleteSavedSearch(id: string): Promise<{ success: boolean }> {
  return postJson(`/api/supabase/saved-searches/${encodeURIComponent(id)}`, {}, 'DELETE')
}

export function getPriceAlerts(): Promise<{ alerts: PriceAlert[] }> {
  return getJson('/api/supabase/price-alerts')
}

export function createPriceAlert(
  saved_search_id: string,
  target_price: number
): Promise<{ alert: PriceAlert }> {
  return postJson('/api/supabase/price-alerts', { saved_search_id, target_price })
}

export async function identifyPartFromImage(
  base64Image: string
): Promise<{ identified: boolean; partName: string | null }> {
  const data = await requestJson<{ identified?: unknown; partName?: unknown }>('/api/identify-part', {
    method: 'POST',
    body: { image: base64Image },
    timeoutMs: AI_TIMEOUT_MS,
    timeoutMessage: 'Photo identification timed out. Try a smaller, tightly cropped photo.',
  })
  if (typeof data.identified !== 'boolean') {
    throw new ApiError('The photo identifier returned an unreadable response. Please try again.', 502)
  }
  if (data.partName !== null && data.partName !== undefined && typeof data.partName !== 'string') {
    throw new ApiError('The photo identifier returned an unreadable response. Please try again.', 502)
  }
  return {
    identified: data.identified,
    partName: data.identified && typeof data.partName === 'string' ? data.partName : null,
  }
}
