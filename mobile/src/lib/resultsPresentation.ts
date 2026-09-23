import type { Listing } from '../api/types'
import { applyListingFilters, type ListingFilters } from './listingFilters'

export type PresentedListing = {
  listing: Listing
  tier: 'verified' | 'fallback'
}

export function presentListings(
  verifiedResults: Listing[],
  fallbackResults: Listing[],
  filters: ListingFilters
) {
  const verified = applyListingFilters(verifiedResults, filters)
  const fallback = applyListingFilters(fallbackResults, filters)
  const items: PresentedListing[] = [
    ...verified.map((listing) => ({ listing, tier: 'verified' as const })),
    ...fallback.map((listing) => ({ listing, tier: 'fallback' as const })),
  ]
  return { verified, fallback, items }
}
