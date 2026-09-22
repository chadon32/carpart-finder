import test from 'node:test'
import assert from 'node:assert/strict'
import { selectAlertListing } from './priceChecker.js'

const listing = (overrides = {}) => ({
  id: 'base',
  title: 'Front Brake Pads',
  condition: 'New',
  price: 40,
  shippingCost: 0,
  verifiedFitment: true,
  ...overrides,
})

test('price alerts use only verified relevant listings with known shipping', () => {
  const selected = selectAlertListing([
    listing({ id: 'unverified', price: 1, verifiedFitment: false }),
    listing({ id: 'accessory', title: 'Brake Pad Retainer Clip', price: 2 }),
    listing({ id: 'unknown-shipping', price: 3, shippingCost: null }),
    listing({ id: 'safe', price: 30, shippingCost: 4 }),
  ], 'Brake Pads')

  assert.equal(selected.item.id, 'safe')
  assert.equal(selected.total, 34)
})

test('price alerts skip a search when no complete verified match exists', () => {
  assert.equal(
    selectAlertListing([listing({ shippingCost: null })], 'Brake Pads'),
    null
  )
})
