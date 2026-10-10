import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareListingsByKnownTotal,
  listingDoesNotContradictVehicle,
  partitionListingsByFitment,
  totalPrice,
  titleDoesNotContradictVehicle,
} from './fitmentPolicy.js'

test('unknown shipping is never represented or ranked as free shipping', () => {
  const known = { id: 'known', price: 20, shippingCost: 5 }
  const unknown = { id: 'unknown', price: 10, shippingCost: null }

  assert.equal(totalPrice(known), 25)
  assert.equal(totalPrice(unknown), Infinity)
  assert.deepEqual([unknown, known].sort(compareListingsByKnownTotal).map((item) => item.id), ['known', 'unknown'])
})

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

// ---- listings that are plainly for other vehicles --------------------------

const lexusRx = { year: '2015', make: 'Lexus', model: 'RX' }

test('a title naming several other vehicles, but not the selected one, is for another vehicle', () => {
  assert.equal(
    titleDoesNotContradictVehicle('2 PACK Cabin Air Filter Upgraded Activated Carbon FITS Accord Civic Odyssey CR-V', lexusRx),
    false,
  )
})

test('heavy-truck makes count as other vehicles', () => {
  assert.equal(titleDoesNotContradictVehicle('Cabin Air Filter PA30269 AF56102 For Kenworth Peterbilt S-9034', lexusRx), false)
  assert.equal(titleDoesNotContradictVehicle('Air Filter for Freightliner Cascadia', lexusRx), false)
})

test('generic titles and a single stray model name are not treated as another vehicle', () => {
  assert.equal(titleDoesNotContradictVehicle('ACDelco Cabin Air Filter', lexusRx), true)
  assert.equal(titleDoesNotContradictVehicle('Premium cabin air filter, replaces Civic style', lexusRx), true)
  assert.equal(titleDoesNotContradictVehicle('Spark plug wire set with boots', { year: '2018', make: 'Honda', model: 'Civic' }), true)
  assert.equal(titleDoesNotContradictVehicle('Brake pad hardware kit, universal fit, with leaf spring clips', lexusRx), true)
})

test('a list of vehicles that includes the selected one is kept', () => {
  assert.equal(titleDoesNotContradictVehicle('Cabin Air Filter for Accord Civic CR-V Odyssey', { year: '2018', make: 'Honda', model: 'Civic' }), true)
  assert.equal(titleDoesNotContradictVehicle('Cabin Air Filter fits Accord Civic CR-V Pilot RX350', lexusRx), false, 'RX350 is not the selected model name unless it is an alias')
  assert.equal(titleDoesNotContradictVehicle('Cabin Air Filter fits Accord Civic CR-V RX350', { ...lexusRx, modelAliases: ['RX350'] }), true)
})

test('models of the selected make are not other vehicles', () => {
  assert.equal(titleDoesNotContradictVehicle('Wiper blades for Camry Corolla RAV4', { year: '2019', make: 'Toyota', model: 'Highlander' }), true)
})
