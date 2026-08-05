import type { Listing } from '../../api/types'
import { defaultFilters } from '../listingFilters'
import { presentListings } from '../resultsPresentation'

const listing = (id: string, price: number) =>
  ({ id, price, condition: 'New', crossBorder: false, sellerFeedbackPercentage: '99' }) as Listing

test('verified listings stay ahead of clearly labeled fallback listings', () => {
  const result = presentListings(
    [listing('verified', 25)],
    [listing('fallback', 5)],
    defaultFilters
  )

  expect(result.items.map((item) => [item.listing.id, item.tier])).toEqual([
    ['verified', 'verified'],
    ['fallback', 'fallback'],
  ])
})

test('fallback-only inventory remains available for an honest secondary section', () => {
  const result = presentListings([], [listing('fallback', 5)], defaultFilters)
  expect(result.verified).toHaveLength(0)
  expect(result.fallback).toHaveLength(1)
  expect(result.items[0].tier).toBe('fallback')
})
