import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEndUserCtx, mapItem } from './ebay.js'

test('buildEndUserCtx with campaign and zip joins with a comma, campaign first', () => {
  assert.equal(
    buildEndUserCtx({ zip: '30301', campaignId: '5339012345' }),
    `affiliateCampaignId=5339012345,contextualLocation=${encodeURIComponent('country=US,zip=30301')}`
  )
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

test('mapItem prefers itemAffiliateWebUrl when present', () => {
  const mapped = mapItem(
    { ...baseItem, itemAffiliateWebUrl: 'https://www.ebay.com/itm/123?mkcid=1&campid=5339012345' },
    { verifiedFitment: true }
  )
  assert.equal(mapped.link, 'https://www.ebay.com/itm/123?mkcid=1&campid=5339012345')
})

test('mapItem falls back to itemWebUrl when no affiliate url exists', () => {
  const mapped = mapItem(baseItem, { verifiedFitment: false })
  assert.equal(mapped.link, 'https://www.ebay.com/itm/123')
})
