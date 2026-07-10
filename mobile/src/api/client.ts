import type { Listing, SearchResponse, VehicleType, VinDecodeResult } from './types'

export const API_BASE = 'https://carpartsradar.com'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-App-Platform': 'ios' },
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
  part: string
): Promise<{ guide: string }> {
  const res = await fetch(`${API_BASE}/api/ai/repair-guide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Platform': 'ios' },
    body: JSON.stringify({ year, make, model, part }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
  return data as { guide: string }
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
