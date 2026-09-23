import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { sanitizeAnalyticsEvent } from '../shared/analyticsPrivacy.mjs'

const vin = '1HGCM82633A004352'
const email = 'driver@example.test'
const rawPart = `Brake Pads ${vin} ${email}`
const rawVehicle = `2020 Toyota Camry ${vin} ${email}`

function assertNoSensitiveValues(event) {
  assert.ok(event)
  const serialized = JSON.stringify(event)
  assert.equal(serialized.includes(vin), false)
  assert.equal(serialized.includes(email), false)
  assert.equal(serialized.includes(rawPart), false)
  assert.equal(serialized.includes(rawVehicle), false)
  assert.equal(serialized.includes('https://'), false)
}

test('trackSearch shape keeps VIN, email, and raw part or vehicle text out of analytics', () => {
  const event = sanitizeAnalyticsEvent('Searched Part', {
    year: vin,
    make: email,
    model: 'Camry',
    trim: rawVehicle,
    part: rawPart,
    vehicleString: rawVehicle,
  })

  assert.deepEqual(event?.properties, {
    partCategoryId: 'other',
    vehicleSelected: true,
    trimSelected: true,
  })
  assertNoSensitiveValues(event)
})

test('results-viewed shape keeps raw search inputs out while retaining bounded counts', () => {
  const event = sanitizeAnalyticsEvent('Search Results Viewed', {
    year: vin,
    make: email,
    model: 'Camry',
    trim: rawVehicle,
    part: rawPart,
    verifiedCount: 99,
    fallbackCount: -4,
    stale: true,
  })

  assert.deepEqual(event?.properties, {
    partCategoryId: 'other',
    verifiedCount: 20,
    fallbackCount: 0,
    hasResults: true,
    stale: true,
  })
  assertNoSensitiveValues(event)
})

test('retailer-click shape keeps raw vehicle, part, listing, and URL values out', () => {
  const event = sanitizeAnalyticsEvent('Retailer Clicked', {
    retailer: 'Amazon',
    placement: 'listing',
    vehicleLabel: rawVehicle,
    part: rawPart,
    listingId: `listing-${vin}`,
    url: `https://amazon.com/item?email=${encodeURIComponent(email)}`,
    fitmentStatus: 'verified',
  })

  assert.deepEqual(event?.properties, {
    retailerId: 'amazon',
    placement: 'listing',
    fitmentStatus: 'verified',
  })
  assertNoSensitiveValues(event)
})

test('guided search shape keeps only the allow-listed guide and static part category ids', () => {
  const event = sanitizeAnalyticsEvent('guide_search_started', {
    guideId: 'compare-total-car-part-cost',
    partCategoryId: rawPart,
    rawSearch: rawPart,
    vehicleString: rawVehicle,
    email,
  })

  assert.deepEqual(event?.properties, {
    guideId: 'compare-total-car-part-cost',
    partCategoryId: 'other',
  })
  assertNoSensitiveValues(event)
  assert.equal(sanitizeAnalyticsEvent('guide_search_started', { guideId: rawPart }), null)
})

test('unknown event names cannot bypass the analytics property allow-list', () => {
  assert.equal(sanitizeAnalyticsEvent('custom-event', { rawSearch: rawPart, email, url: 'https://example.test' }), null)
})

test('PostHog cannot collect DOM, URL, performance, or session-replay input', async () => {
  const analytics = await readFile(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8')
  assert.match(analytics, /autocapture:\s*false/)
  assert.match(analytics, /capture_pageview:\s*false/)
  assert.match(analytics, /disable_session_recording:\s*true/)
  assert.match(analytics, /disable_persistence:\s*true/)
  assert.match(analytics, /cookieless_mode:\s*'always'/)
  assert.match(analytics, /before_send:/)
})
