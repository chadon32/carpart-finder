import type { Listing } from '../../api/types'
import { fitmentPresentation } from '../fitmentPresentation'

const listing = (overrides: Partial<Listing> = {}): Listing => ({
  id: 'listing-1',
  title: 'Brake Pad Set',
  price: 50,
  currency: 'USD',
  condition: 'New',
  seller: 'seller',
  sellerFeedbackPercentage: '99.9',
  image: null,
  link: 'https://example.test/item',
  source: 'eBay',
  crossBorder: false,
  ...overrides,
})

test('explains exactly what a verified marketplace match did and did not confirm', () => {
  const presentation = fitmentPresentation(listing({
    verifiedFitment: true,
    fitmentEvidence: {
      provider: 'eBay',
      matchType: 'EXACT',
      scope: 'year-make-model',
      matchedVehicle: { year: '2020', make: 'Toyota', model: 'Camry' },
      checkedAt: '2026-08-02T00:00:00.000Z',
      note: 'Exact provider match',
    },
  }))

  expect(presentation.title).toMatch(/match/i)
  expect(presentation.scope).toBe('Year, make, and model')
  expect(presentation.matchedVehicle).toBe('2020 Toyota Camry')
  expect(presentation.description).toMatch(/engine/i)
  expect(presentation.checkedAt).not.toBeNull()
})

test('never implies compatibility for fallback inventory', () => {
  const presentation = fitmentPresentation(listing())

  expect(presentation.title).toMatch(/not confirmed/i)
  expect(presentation.scope).toMatch(/no structured/i)
  expect(presentation.matchedVehicle).toBeNull()
  expect(presentation.checkedAt).toBeNull()
})

test('hides malformed provider timestamps instead of displaying an invalid date', () => {
  const presentation = fitmentPresentation(listing({
    verifiedFitment: true,
    fitmentEvidence: {
      provider: 'eBay',
      matchType: 'EXACT',
      scope: 'year-make-model',
      matchedVehicle: { year: '2020', make: 'Toyota', model: 'Camry' },
      checkedAt: 'not-a-date',
      note: 'Exact provider match',
    },
  }))

  expect(presentation.checkedAt).toBeNull()
})
