import { applyListingFilters, activeFilterCount, defaultFilters } from '../listingFilters'
import type { Listing } from '../../api/types'

const l = (over: Partial<Listing>): Listing =>
  ({ id: Math.random().toString(), price: 10, condition: 'New', crossBorder: false, sellerFeedbackPercentage: '99.0', ...over }) as Listing

test('best preserves server order', () => {
  const a = l({ id: 'a', price: 30 })
  const b = l({ id: 'b', price: 10 })
  expect(applyListingFilters([a, b], defaultFilters).map((x) => x.id)).toEqual(['a', 'b'])
})

test('price and total sort ascending', () => {
  const a = l({ id: 'a', price: 30, shippingCost: 0 })
  const b = l({ id: 'b', price: 10, shippingCost: 25 })
  expect(applyListingFilters([a, b], { ...defaultFilters, sort: 'price' })[0].id).toBe('b')
  expect(applyListingFilters([a, b], { ...defaultFilters, sort: 'total' })[0].id).toBe('a')
})

test('rating sorts descending with unrated last', () => {
  const a = l({ id: 'a', sellerFeedbackPercentage: '95.0' })
  const b = l({ id: 'b', sellerFeedbackPercentage: null })
  const c = l({ id: 'c', sellerFeedbackPercentage: '99.5' })
  expect(applyListingFilters([a, b, c], { ...defaultFilters, sort: 'rating' }).map((x) => x.id)).toEqual(['c', 'a', 'b'])
})

test('hideOverseas drops crossBorder listings', () => {
  const res = applyListingFilters(
    [l({ id: 'a', crossBorder: true }), l({ id: 'b' })],
    { ...defaultFilters, hideOverseas: true }
  )
  expect(res.map((x) => x.id)).toEqual(['b'])
})

test('minRating drops low and unrated listings only when set', () => {
  const rows = [l({ id: 'a', sellerFeedbackPercentage: '91.0' }), l({ id: 'b', sellerFeedbackPercentage: null })]
  expect(applyListingFilters(rows, { ...defaultFilters, minRating: 95 })).toHaveLength(0)
  expect(applyListingFilters(rows, defaultFilters)).toHaveLength(2)
})

test('condition filter matches new/used', () => {
  const rows = [l({ id: 'a', condition: 'New' }), l({ id: 'b', condition: 'Used - Good' })]
  expect(applyListingFilters(rows, { ...defaultFilters, condition: 'used' })[0].id).toBe('b')
})

test('activeFilterCount counts non-defaults', () => {
  expect(activeFilterCount(defaultFilters)).toBe(0)
  expect(
    activeFilterCount({ sort: 'price', hideOverseas: true, minRating: 95, condition: 'new' })
  ).toBe(4)
})
