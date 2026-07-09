// Domain types mirrored verbatim from the web client (src/api/client.ts).
// Keep in sync manually — the API is the shared contract.

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
  // False when eBay's compatibility filter couldn't be applied and the results
  // came from a relaxed keyword search instead.
  verifiedFitment?: boolean
}

export type SearchResponse = {
  query: string
  results: Listing[]
  providerErrors: Record<string, string>
  skippedProviders: string[]
  cached?: boolean
  // True when live search failed and these are recent last-known-good results.
  stale?: boolean
}

export type VehicleType = 'all' | 'car' | 'suv' | 'truck'

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

export type Car = { year: string; make: string; model: string; trim: string }

export type GarageVehicle = Car & { vin?: string; mileage?: number }
