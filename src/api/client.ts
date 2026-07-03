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
}

export type SearchResponse = {
  query: string
  results: Listing[]
  providerErrors: Record<string, string>
  skippedProviders: string[]
  cached?: boolean
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }
  return data as T
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

export function fetchVehicleImage(make: string, model: string): Promise<{ imageUrl: string | null }> {
  const params = new URLSearchParams({ make, model })
  return getJson(`/api/vehicle-image?${params.toString()}`)
}

export type PriceInfo = { available: boolean; price?: number | null }

export function fetchPrices(ids: string[]): Promise<{ prices: Record<string, PriceInfo> }> {
  const params = new URLSearchParams({ ids: ids.join(',') })
  return getJson(`/api/prices?${params.toString()}`)
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
  return getJson(`/api/search?${params.toString()}`)
}
