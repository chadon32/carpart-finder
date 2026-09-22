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

export const knownTotal = (l: Listing): number | null => {
  if (l.shippingCost == null || !Number.isFinite(l.shippingCost)) return null
  return l.price + l.shippingCost
}

export const compareKnownTotal = (a: Listing, b: Listing) => {
  const aTotal = knownTotal(a)
  const bTotal = knownTotal(b)
  if (aTotal == null && bTotal == null) return a.price - b.price || a.id.localeCompare(b.id)
  if (aTotal == null) return 1
  if (bTotal == null) return -1
  return aTotal - bTotal || a.price - b.price || a.id.localeCompare(b.id)
}

export function valueScore(l: Listing) {
  const total = knownTotal(l)
  if (total == null) return Infinity
  const feedback = rating(l) ?? 92
  const trust = Math.min(100, Math.max(80, feedback))
  const penalty = (100 - trust) / 100
  let effective = total * (1 + penalty)
  if (l.topRatedSeller) effective *= 0.95
  return effective
}

export function compareValueEstimate(a: Listing, b: Listing) {
  return valueScore(a) - valueScore(b) || compareKnownTotal(a, b)
}

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
  if (f.sort === 'price') out = [...out].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
  else if (f.sort === 'total') out = [...out].sort(compareKnownTotal)
  else if (f.sort === 'rating')
    out = [...out].sort((a, b) => (rating(b) ?? -1) - (rating(a) ?? -1))
  else if (f.sort === 'best') out = [...out].sort(compareValueEstimate)
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
