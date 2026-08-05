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
  // Only structured marketplace compatibility matches appear here.
  results: Listing[]
  // Broad keyword results stay separate and are always labeled unverified.
  fallbackResults?: Listing[]
  fitmentSummary?: { verified: number; fallback: number; hiddenIrrelevantFallbacks?: number }
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
