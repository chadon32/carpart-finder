import type { Listing, SearchResponse, VehicleType, VinDecodeResult } from './types'

export const API_BASE = 'https://carpartsradar.com'

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

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-App-Platform': 'ios' },
    credentials: 'include',
  })
  const data = await res.json()
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error || `Request failed (${res.status})`,
      res.status
    )
  }
  return data as T
}

async function postJson<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-App-Platform': 'ios' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  }
  return data as T
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

export function searchParts(
  year: string,
  make: string,
  model: string,
  part: string,
  trim?: string,
  zip?: string
): Promise<SearchResponse> {
  const params = new URLSearchParams({ year, make, model, part })
  if (trim) params.set('trim', trim)
  if (zip) params.set('zip', zip)
  return getJson(`/api/search?${params}`)
}

export type PriceObservation = { date: string; price: number }

export function fetchPriceHistory(
  year: string,
  make: string,
  model: string,
  part: string
): Promise<{ observations: PriceObservation[] }> {
  return getJson(`/api/price-history?${new URLSearchParams({ year, make, model, part })}`)
}

export type QuoteItem = {
  part: string
  listing: Listing | null
  error?: boolean
}

export type QuoteResponse = {
  items: QuoteItem[]
  subtotal: number
  shipping: number
  total: number
  currency: string
}

export function fetchQuote(
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
  return getJson(`/api/quote?${params}`)
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

export type Recall = {
  campaignNumber: string | null
  component: string | null
  summary: string | null
  consequence: string | null
  remedy: string | null
  reportedDate: string | null
}

export function fetchRecalls(year: string, make: string, model: string): Promise<{ recalls: Recall[] }> {
  return getJson(`/api/recalls?${new URLSearchParams({ year, make, model })}`)
}

export async function fetchRepairGuide(
  year: string,
  make: string,
  model: string,
  part: string,
  signal?: AbortSignal
): Promise<{ guide: string }> {
  const res = await fetch(`${API_BASE}/api/ai/repair-guide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Platform': 'ios' },
    body: JSON.stringify({ year, make, model, part }),
    signal,
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  return data as { guide: string }
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
  return postJson(`/api/supabase/saved-searches/${id}`, {}, 'DELETE')
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
  const res = await fetch(`${API_BASE}/api/identify-part`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Platform': 'ios' },
    body: JSON.stringify({ image: base64Image }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  return data as { identified: boolean; partName: string | null }
}
