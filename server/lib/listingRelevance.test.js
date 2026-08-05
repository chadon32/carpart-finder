import test from 'node:test'
import assert from 'node:assert/strict'
import { filterListingsByPartIntent, listingMatchesPartIntent } from './listingRelevance.js'

test('keeps actual brake pad listings and removes accessory-only fallbacks', () => {
  assert.equal(listingMatchesPartIntent({ title: 'Ceramic Brake Pad Set with Hardware' }, 'Brake Pads'), true)
  assert.equal(listingMatchesPartIntent({ title: 'Brake Pad Wear Sensor' }, 'Brake Pads'), false)
  assert.equal(listingMatchesPartIntent({ title: 'Brake Pad Hardware Clip Kit' }, 'Brake Pads'), false)
  assert.equal(listingMatchesPartIntent({ title: 'Disc Brake Pad Shoes Accessories' }, 'Brake Pads'), false)
  assert.equal(listingMatchesPartIntent({ title: 'CLIP' }, 'Brake Pads'), false)
})

test('accepts OE-number and unfamiliar custom searches without guessing', () => {
  assert.equal(listingMatchesPartIntent({ title: 'Genuine Toyota pad set 04465-0K010' }, '04465-0K010'), true)
  assert.equal(listingMatchesPartIntent({ title: 'Specialized aftermarket component' }, 'Custom suspension bracket'), true)
  assert.equal(listingMatchesPartIntent({ title: 'O2 sensor socket tool' }, 'O2 Sensor'), false)
})

test('filters fallback inventory without touching the original listing objects', () => {
  const listings = [
    { id: 'pads', title: 'Brake Pads Ceramic Set' },
    { id: 'clip', title: 'Brake Pad Clip' },
  ]

  assert.deepEqual(filterListingsByPartIntent(listings, 'Brake Pads').map((listing) => listing.id), ['pads'])
  assert.equal(listings.length, 2)
})
