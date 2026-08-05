import test from 'node:test'
import assert from 'node:assert/strict'
import {
  listingDoesNotContradictVehicle,
  partitionListingsByFitment,
  titleDoesNotContradictVehicle,
} from './fitmentPolicy.js'

test('fitment policy keeps uncertain inventory out of verified results', () => {
  const { verified, fallback } = partitionListingsByFitment([
    { id: 'honda', source: 'eBay', seller: 'one', price: 10, verifiedFitment: false },
    { id: 'camry', source: 'eBay', seller: 'two', price: 30, verifiedFitment: true },
    { id: 'missing', source: 'AliExpress', seller: 'three', price: 5 },
  ], 15)

  assert.deepEqual(verified.map((item) => item.id), ['camry'])
  assert.deepEqual(fallback.map((item) => item.id), ['missing', 'honda'])
})

test('fitment policy applies limits independently to primary and fallback groups', () => {
  const { verified, fallback } = partitionListingsByFitment([
    { id: 'v1', source: 'eBay', price: 20, verifiedFitment: true },
    { id: 'v2', source: 'eBay', price: 10, verifiedFitment: true },
    { id: 'f1', source: 'eBay', price: 30, verifiedFitment: false },
    { id: 'f2', source: 'eBay', price: 5, verifiedFitment: false },
  ], 1)

  assert.deepEqual(verified.map((item) => item.id), ['v2'])
  assert.deepEqual(fallback.map((item) => item.id), ['f2'])
})

test('title contradiction check fails closed on another make or model', () => {
  const camry = { year: '2020', make: 'Toyota', model: 'Camry' }
  assert.equal(titleDoesNotContradictVehicle('Rear Brake Pads for Chrysler 300', camry), false)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for Toyota Sienna and Highlander', camry), false)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for Lexus ES and UX', camry), false)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for Toyota Camry and Lexus ES', camry), true)
  assert.equal(titleDoesNotContradictVehicle('D2076 Ceramic Brake Pads', camry), true)
})

test('title contradiction check fails closed when an explicit year range excludes the vehicle', () => {
  const camry = { year: '2020', make: 'Toyota', model: 'Camry' }
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for 2009-2013 Toyota Camry', camry), false)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for 2009–2013 Toyota Camry', camry), false)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for 2018—2021 Toyota Camry', camry), true)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for Toyota Camry 2009 - 13', camry), false)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for 2018-2021 Toyota Camry', camry), true)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for Toyota Camry 2020', camry), true)
  assert.equal(titleDoesNotContradictVehicle('Wagner ZD1212 Disc Brake Pad Set', camry), true)
  assert.equal(titleDoesNotContradictVehicle('Brake Pads for Opel Manta 1975 only', camry), false)
})

test('listing contradiction check also validates structured listing details', () => {
  const camry = { year: '2020', make: 'Toyota', model: 'Camry' }
  assert.equal(
    listingDoesNotContradictVehicle(
      { title: 'Ceramic Brake Pads', shortDescription: 'Fits Ford F-250 2017-2022' },
      camry
    ),
    false
  )
  assert.equal(
    listingDoesNotContradictVehicle({ title: 'D2076 Ceramic Brake Pads' }, camry),
    true
  )
})
