import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSearchAttempts,
  buildEndUserCtx,
  filterExactCompatibility,
  filterVehicleContradictions,
  isExactCompatibility,
  mapItem,
  marketplaceSearchKeyword,
} from './ebay.js'

test('buildEndUserCtx with campaign and zip joins with a comma, campaign first', () => {
  assert.equal(
    buildEndUserCtx({ zip: '30301', campaignId: '5339012345' }),
    `affiliateCampaignId=5339012345,contextualLocation=${encodeURIComponent('country=US,zip=30301')}`
  )
})

test('buildEndUserCtx includes an optional EPN reference id for channel reporting', () => {
  assert.equal(
    buildEndUserCtx({
      zip: '30301',
      campaignId: '5339012345',
      referenceId: 'cpr-ios-search',
    }),
    `affiliateCampaignId=5339012345,affiliateReferenceId=cpr-ios-search,contextualLocation=${encodeURIComponent('country=US,zip=30301')}`
  )
})

test('buildEndUserCtx never sends a reference id without a campaign id', () => {
  assert.equal(buildEndUserCtx({ referenceId: 'cpr-ios-search' }), undefined)
})

test('buildEndUserCtx with only zip matches the legacy header exactly', () => {
  assert.equal(
    buildEndUserCtx({ zip: '30301' }),
    `contextualLocation=${encodeURIComponent('country=US,zip=30301')}`
  )
})

test('buildEndUserCtx with only campaign id', () => {
  assert.equal(buildEndUserCtx({ campaignId: '5339012345' }), 'affiliateCampaignId=5339012345')
})

test('buildEndUserCtx with neither returns undefined', () => {
  assert.equal(buildEndUserCtx({}), undefined)
  assert.equal(buildEndUserCtx(), undefined)
})

const baseItem = {
  itemId: '123',
  title: 'Brake Pads',
  itemWebUrl: 'https://www.ebay.com/itm/123',
  price: { value: '25.00', currency: 'USD' },
}

test('only an explicit EXACT compatibility result is verified', () => {
  assert.equal(isExactCompatibility({ compatibilityMatch: 'EXACT' }), true)
  assert.equal(isExactCompatibility({ compatibilityMatch: 'POSSIBLE' }), false)
  assert.equal(isExactCompatibility({}), false)
  assert.deepEqual(
    filterExactCompatibility([
      { itemId: 'exact', compatibilityMatch: 'EXACT' },
      { itemId: 'possible', compatibilityMatch: 'POSSIBLE' },
      { itemId: 'missing' },
    ]).map((item) => item.itemId),
    ['exact']
  )
})

test('marketplace keyword uses the part name without over-narrowing on trim', () => {
  assert.equal(
    marketplaceSearchKeyword({
      part: 'Brake Pads',
      trim: 'LE Sedan 4-Door',
      query: '2020 Toyota Camry LE Sedan 4-Door Brake Pads',
    }),
    'Brake Pads'
  )
  assert.equal(marketplaceSearchKeyword({ query: 'legacy query' }), 'legacy query')
})

test('compatibility search uses relevance before price-sorted fallback attempts', () => {
  const attempts = buildSearchAttempts(
    {
      part: 'Brake Pads',
      trim: 'LE Sedan 4-Door',
      query: '2020 Toyota Camry LE Sedan 4-Door Brake Pads',
    },
    {
      categoryId: '33567',
      compatibilityFilter: 'Year:2020;Make:Toyota;Model:Camry',
      zip: '85001',
      sort: 'price',
    }
  )

  assert.equal(attempts[0].q, 'Brake Pads')
  assert.equal(attempts[0].sort, 'relevance')
  assert.equal(attempts[0].compatibilityFilter, 'Year:2020;Make:Toyota;Model:Camry')
  assert.equal(attempts[1].sort, 'price')
  assert.equal(attempts[1].compatibilityFilter, undefined)
})

test('mapItem cannot mark missing or POSSIBLE compatibility as verified', () => {
  const filtered = { compatibilityFilterUsed: true, vehicle: { year: '2020', make: 'Toyota', model: 'Camry' } }
  assert.equal(mapItem({ ...baseItem, title: 'Brake Pads for Toyota Camry', compatibilityMatch: 'EXACT' }, filtered).verifiedFitment, true)
  assert.equal(mapItem({ ...baseItem, compatibilityMatch: 'POSSIBLE' }, filtered).verifiedFitment, false)
  assert.equal(mapItem(baseItem, filtered).verifiedFitment, false)
  assert.equal(
    mapItem({ ...baseItem, compatibilityMatch: 'EXACT' }, { compatibilityFilterUsed: false }).verifiedFitment,
    false,
    'an EXACT-looking value from an unfiltered fallback search is not proof'
  )
})

test('mapItem demotes an exact provider response when the title contradicts the vehicle', () => {
  const mapped = mapItem(
    { ...baseItem, title: 'Rear Brake Pads for Chrysler 300', compatibilityMatch: 'EXACT' },
    { compatibilityFilterUsed: true, vehicle: { year: '2020', make: 'Toyota', model: 'Camry' } }
  )
  assert.equal(mapped.verifiedFitment, false)
  assert.equal(mapped.fitmentTier, 'fallback')
  assert.match(mapped.fitmentEvidence.note, /conflicted/i)
})

test('mapItem demotes an exact provider response when listing details exclude the selected year', () => {
  const mapped = mapItem(
    {
      ...baseItem,
      title: 'Brake Pads for Toyota Camry',
      shortDescription: 'TOYOTA CAMRY 2007 - 2017 All Models',
      compatibilityMatch: 'EXACT',
    },
    { compatibilityFilterUsed: true, vehicle: { year: '2020', make: 'Toyota', model: 'Camry' } }
  )
  assert.equal(mapped.verifiedFitment, false)
  assert.equal(mapped.fitmentTier, 'fallback')
  assert.match(mapped.fitmentEvidence.note, /model years/i)
})

test('mapItem does not let a broad title override narrower incompatible listing details', () => {
  const mapped = mapItem(
    {
      ...baseItem,
      title: 'Brake Pads for Toyota Camry 2007-2023',
      shortDescription: 'Toyota Camry 2007-2019; Toyota Camry 2023 Hybrid',
      compatibilityMatch: 'EXACT',
    },
    { compatibilityFilterUsed: true, vehicle: { year: '2020', make: 'Toyota', model: 'Camry' } }
  )
  assert.equal(mapped.verifiedFitment, false)
})

test('broad search removes explicit vehicle contradictions but keeps generic candidates', () => {
  const vehicle = { year: '2020', make: 'Toyota', model: 'Camry' }
  const items = [
    { ...baseItem, itemId: 'generic', title: 'D2076 Ceramic Brake Pads' },
    { ...baseItem, itemId: 'ford', title: 'Front brake pad hardware Ford F250' },
    { ...baseItem, itemId: 'nissan', title: 'Brake Pads for Nissan Stanza 1982' },
    { ...baseItem, itemId: 'camry', title: 'Brake Pads for 2018-2021 Toyota Camry' },
  ]

  assert.deepEqual(
    filterVehicleContradictions(items, vehicle).map((item) => item.itemId),
    ['generic', 'camry']
  )
})

test('mapItem prefers itemAffiliateWebUrl when present', () => {
  const mapped = mapItem(
    { ...baseItem, itemAffiliateWebUrl: 'https://www.ebay.com/itm/123?mkcid=1&campid=5339012345' }
  )
  assert.equal(mapped.link, 'https://www.ebay.com/itm/123?mkcid=1&campid=5339012345')
})

test('mapItem falls back to itemWebUrl when no affiliate url exists', () => {
  const mapped = mapItem(baseItem)
  assert.equal(mapped.link, 'https://www.ebay.com/itm/123')
})
