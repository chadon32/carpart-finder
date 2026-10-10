process.env.EBAY_CLIENT_ID = 'test-id'
process.env.EBAY_CLIENT_SECRET = 'test-secret'

import test from 'node:test'
import assert from 'node:assert/strict'

const realFetch = globalThis.fetch
test.after(() => { globalThis.fetch = realFetch })

let counter = 100
const item = (title, price) => {
  counter += 1
  return {
    itemId: `v1|${counter}|0`,
    title,
    price: { value: String(price), currency: 'USD' },
    itemWebUrl: `https://www.ebay.com/itm/${counter}`,
    seller: { username: `seller${counter}`, feedbackPercentage: '99.0' },
    condition: 'New',
    compatibilityMatch: 'EXACT',
    shippingOptions: [{ shippingCost: { value: '0' } }],
  }
}

function stubEbay({ models, byFilter = {}, byQuery = {} }) {
  globalThis.fetch = (url, init) => {
    const u = new URL(String(url))
    const json = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    if (u.pathname.endsWith('/oauth2/token')) return json({ access_token: 'token', expires_in: 7200 })
    if (u.pathname.endsWith('/get_default_category_tree_id')) return json({ categoryTreeId: '100' })
    if (u.pathname.endsWith('/get_compatibility_property_values')) return json({ compatibilityPropertyValues: models.map((value) => ({ value })) })
    if (u.pathname.endsWith('/item_summary/search')) {
      const filter = u.searchParams.get('compatibility_filter')
      return json({ itemSummaries: (filter ? byFilter[filter] : byQuery[u.searchParams.get('q')]) ?? [] })
    }
    return realFetch(url, init)
  }
}

const { searchCheapestListings } = await import('./search.js')

test('the response names the eBay model variants that matched when they differ from the selected model', async () => {
  stubEbay({
    models: ['RX350', 'RX450h'],
    byFilter: {
      'Year:2015;Make:Lexus;Model:RX350': [item('Cabin Air Filter for Lexus RX350', 12)],
      'Year:2015;Make:Lexus;Model:RX450h': [item('Cabin Air Filter for Lexus RX450h', 14)],
    },
  })

  const data = await searchCheapestListings({ year: '2015', make: 'Lexus', model: 'RX', part: 'Cabin Air Filter', zip: '10001' })

  assert.equal(data.results.length, 2)
  assert.deepEqual(data.fitmentSummary.matchedModels, ['RX350', 'RX450h'])
  assert.equal(data.partNumberSearch, false)
})

test('a model that eBay spells the same apart from capitalization reports no variants', async () => {
  stubEbay({
    models: ['F-Pace'],
    byFilter: { 'Year:2019;Make:Jaguar;Model:F-Pace': [item('Brake Pads for Jaguar F-Pace', 30)] },
  })

  const data = await searchCheapestListings({ year: '2019', make: 'Jaguar', model: 'F-PACE', part: 'Brake Pads', zip: '10002' })

  assert.equal(data.results.length, 1)
  assert.deepEqual(data.fitmentSummary.matchedModels, [])
})

test('a part-number search says so, and its listings are not counted as confirmed fits', async () => {
  stubEbay({
    models: ['Camry'],
    byQuery: { '26350-2T000': [{ ...item('Genuine Oil Filter 26350-2T000 for Genesis G70', 8), compatibilityMatch: undefined }] },
  })

  const data = await searchCheapestListings({ year: '2019', make: 'Toyota', model: 'Camry', part: '26350-2T000', zip: '10003' })

  assert.equal(data.partNumberSearch, true)
  assert.equal(data.results.length, 0)
  assert.equal(data.fallbackResults.length, 1)
  assert.equal(data.fallbackResults[0].partNumberMatch, 'exact')
})
