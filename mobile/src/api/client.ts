import type { SearchResponse, VehicleType, VinDecodeResult } from './types'

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
  trim?: string
): Promise<SearchResponse> {
  const params = new URLSearchParams({ year, make, model, part })
  if (trim) params.set('trim', trim)
  return getJson(`/api/search?${params}`)
}

export function decodeVinApi(vin: string): Promise<VinDecodeResult> {
  return getJson(`/api/vin?${new URLSearchParams({ vin })}`)
}
