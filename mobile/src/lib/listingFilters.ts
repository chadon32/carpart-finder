import type { Listing } from '../api/types'

export type ListingFilters = {
  sort: 'best' | 'price' | 'total' | 'rating'
  hideOverseas: boolean
  minRating: 0 | 90 | 95 | 98
  condition: 'all' | 'new' | 'used'
}

export const defaultFilters: ListingFilters = {
  sort: 'best',
  hideOverseas: false,
  minRating: 0,
  condition: 'all',
}

const rating = (l: Listing): number | null => {
  if (l.sellerFeedbackPercentage == null) return null
  const n = parseFloat(l.sellerFeedbackPercentage)
  return Number.isFinite(n) ? n : null
}

const total = (l: Listing) => l.price + (l.shippingCost ?? 0)

export function applyListingFilters(results: Listing[], f: ListingFilters): Listing[] {
  let out = results.filter((l) => {
    if (f.hideOverseas && l.crossBorder) return false
    if (f.minRating > 0) {
      const r = rating(l)
      // No rating at all fails a rating floor — never assume a good record.
      if (r == null || r < f.minRating) return false
    }
    if (f.condition !== 'all' && !l.condition.toLowerCase().includes(f.condition)) return false
    return true
  })
  if (f.sort === 'price') out = [...out].sort((a, b) => a.price - b.price)
  else if (f.sort === 'total') out = [...out].sort((a, b) => total(a) - total(b))
  else if (f.sort === 'rating')
    out = [...out].sort((a, b) => (rating(b) ?? -1) - (rating(a) ?? -1))
  return out
}

export function activeFilterCount(f: ListingFilters): number {
  let n = 0
  if (f.sort !== 'best') n++
  if (f.hideOverseas) n++
  if (f.minRating !== 0) n++
  if (f.condition !== 'all') n++
  return n
}
