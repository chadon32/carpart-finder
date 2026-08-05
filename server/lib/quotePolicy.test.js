import test from 'node:test'
import assert from 'node:assert/strict'
import { pickVerifiedListingForPart } from './quotePolicy.js'

const listing = (overrides = {}) => ({
  id: 'base',
  title: 'Front Brake Pads',
  condition: 'New',
  price: 40,
  shippingCost: 0,
  verifiedFitment: true,
  ...overrides,
})

test('automatic quote never falls back to an unverified listing', () => {
  assert.equal(
    pickVerifiedListingForPart([listing({ verifiedFitment: false })], 'Brake Pads'),
    null
  )
})

test('automatic quote chooses the cheapest verified relevant listing', () => {
  const picked = pickVerifiedListingForPart([
    listing({ id: 'unverified-cheap', verifiedFitment: false, price: 5 }),
    listing({ id: 'verified-expensive', price: 55 }),
    listing({ id: 'verified-cheap', price: 42, shippingCost: 3 }),
  ], 'Brake Pads')
  assert.equal(picked.id, 'verified-cheap')
})

test('automatic quote rejects accessories and broken inventory', () => {
  assert.equal(
    pickVerifiedListingForPart([
      listing({ title: 'Brake Pad Retainer Clip', price: 5 }),
      listing({ title: 'Brake Pads', condition: 'For parts only', price: 3 }),
    ], 'Brake Pads'),
    null
  )
})
