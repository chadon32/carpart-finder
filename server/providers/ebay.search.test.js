process.env.EBAY_CLIENT_ID = 'test-id'
process.env.EBAY_CLIENT_SECRET = 'test-secret'

import test from 'node:test'
import assert from 'node:assert/strict'

const realFetch = globalThis.fetch
test.after(() => { globalThis.fetch = realFetch })

// A small stand-in for the three eBay endpoints a search touches. Each test
// supplies the model list and the items eBay would return per compatibility
// filter or keyword; every Browse request is recorded.
function stubEbay({ models = [], modelsFail = false, byFilter = {}, byQuery = {} }) {
  const searches = []
  globalThis.fetch = (url, init) => {
    const u = new URL(String(url))
    const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
    if (u.pathname.endsWith('/oauth2/token')) return json({ access_token: 'token', expires_in: 7200 })
    if (u.pathname.endsWith('/get_default_category_tree_id')) return json({ categoryTreeId: '100' })
    if (u.pathname.endsWith('/get_compatibility_property_values')) {
      if (modelsFail) return json({ error: 'down' }, 500)
      return json({ compatibilityPropertyValues: models.map((value) => ({ value })) })
    }
    if (u.pathname.endsWith('/item_summary/search')) {
      const filter = u.searchParams.get('compatibility_filter')
      const q = u.searchParams.get('q')
      searches.push({ q, filter, category: u.searchParams.get('category_ids') })
      const items = filter ? byFilter[filter] : byQuery[q]
      return json({ itemSummaries: items ?? [] })
    }
    return realFetch(url, init)
  }
  return searches
}

let counter = 0
function item(title, { seller, compat = 'EXACT', price = 20 } = {}) {
  counter += 1
  return {
    itemId: `v1|${counter}|0`,
    title,
    price: { value: String(price), currency: 'USD' },
    itemWebUrl: `https://www.ebay.com/itm/${counter}`,
    seller: { username: seller ?? `seller${counter}`, feedbackPercentage: '99.0' },
    condition: 'New',
    compatibilityMatch: compat,
  }
}

const { search } = await import('./ebay.js')

test('a model eBay names differently is searched under every eBay variant, and each listing says which it matched', async () => {
  const searches = stubEbay({
    models: ['ES350', 'RX350', 'RX450h'],
    byFilter: {
      'Year:2015;Make:Lexus;Model:RX350': [item('Cabin Air Filter for Lexus RX350 2010-2015', { price: 12 })],
      'Year:2015;Make:Lexus;Model:RX450h': [item('Cabin Air Filter fits RX450h', { price: 9 })],
    },
  })

  const results = await search({ year: '2015', make: 'LEXUS', model: 'RX', part: 'Cabin Air Filter', query: '2015 LEXUS RX Cabin Air Filter' })

  const filters = searches.map((s) => s.filter).filter(Boolean)
  assert.deepEqual(filters.sort(), ['Year:2015;Make:Lexus;Model:RX350', 'Year:2015;Make:Lexus;Model:RX450h'])
  assert.equal(results.length, 2)
  assert.ok(results.every((r) => r.verifiedFitment === true))
  assert.deepEqual(results.map((r) => r.fitmentEvidence.matchedVehicle.model).sort(), ['RX350', 'RX450h'])
})

test('a model that differs only in capitalization is searched with eBay spelling', async () => {
  const searches = stubEbay({
    models: ['E-Pace', 'F-Pace'],
    byFilter: { 'Year:2019;Make:Jaguar;Model:F-Pace': [item('Brake Pads for Jaguar F-Pace')] },
  })

  const results = await search({ year: '2019', make: 'JAGUAR', model: 'F-PACE', part: 'Brake Pads', query: '2019 JAGUAR F-PACE Brake Pads' })

  assert.equal(searches[0].filter, 'Year:2019;Make:Jaguar;Model:F-Pace')
  assert.equal(results.length, 1)
  assert.equal(results[0].verifiedFitment, true)
  assert.equal(results[0].fitmentEvidence.matchedVehicle.model, 'F-Pace')
})

test('when eBay model data is unavailable the search still runs with the model as given', async () => {
  const searches = stubEbay({
    modelsFail: true,
    byFilter: { 'Year:2018;Make:Honda;Model:Civic': [item('Brake Pads for Honda Civic')] },
  })

  const results = await search({ year: '2018', make: 'HONDA', model: 'Civic', part: 'Brake Pads', query: '2018 HONDA Civic Brake Pads' })

  assert.equal(searches[0].filter, 'Year:2018;Make:Honda;Model:Civic')
  assert.equal(results.length, 1)
  assert.equal(results[0].verifiedFitment, true)
})

test('a title that names the eBay variant but not the short model is not treated as a contradiction', async () => {
  stubEbay({
    models: ['RX350'],
    byFilter: { 'Year:2015;Make:Lexus;Model:RX350': [item('2015 Lexus RX350 front brake pads')] },
  })

  const results = await search({ year: '2015', make: 'Lexus', model: 'RX', part: 'Brake Pads', query: '2015 Lexus RX Brake Pads' })

  assert.equal(results.length, 1)
  assert.equal(results[0].verifiedFitment, true)
})

// ---- part numbers ----------------------------------------------------------

test('a part number is searched on its own, and listings that state it are kept even when the title names another vehicle', async () => {
  const searches = stubEbay({
    models: ['Camry'],
    byFilter: {},
    byQuery: {
      '26350-2T000': [
        item('Genuine Oil Filter 26350-2T000 for Genesis G70 Stinger', { price: 8 }),
        item('Oil filter wrench cap socket', { price: 5 }),
      ],
    },
  })

  const results = await search({ year: '2019', make: 'Toyota', model: 'Camry', part: '26350-2T000', query: '2019 Toyota Camry 26350-2T000' })

  assert.ok(searches.some((s) => s.q === '26350-2T000' && !s.filter), 'the number is sent as typed with no vehicle words')
  assert.equal(results.length, 1)
  assert.match(results[0].title, /26350-2T000/)
  assert.equal(results[0].partNumberMatch, 'exact')
  assert.equal(results[0].verifiedFitment, false)
})

test('a part number written with separators also finds listings that write it without them', async () => {
  const searches = stubEbay({
    models: ['Civic'],
    byQuery: {
      '26350-2T000': [],
      '26350 2T000': [item('OEM 263502T000 oil filter', { price: 7 })],
    },
  })

  const results = await search({ year: '2018', make: 'Honda', model: 'Civic', part: '26350-2T000', query: '2018 Honda Civic 26350-2T000' })

  assert.ok(searches.some((s) => s.q === '26350 2T000'))
  assert.equal(results.length, 1)
  assert.equal(results[0].partNumberMatch, 'exact')
})

test('when no listing states the number, only related listings that fit the vehicle are returned, and marked related', async () => {
  stubEbay({
    models: ['Camry'],
    byQuery: {
      '04465-0K010': [
        item('04465-0K160 Toyota Genuine OEM Front Brake Pad Kit', { price: 40 }),
        item('Front Brake Pads for 2019 Toyota Camry', { price: 25 }),
        item('Ceramic brake pads for 2020 Mazda CX-30', { price: 22 }),
      ],
    },
  })

  const results = await search({ year: '2019', make: 'Toyota', model: 'Camry', part: '04465-0K010', query: '2019 Toyota Camry 04465-0K010' })

  assert.deepEqual(results.map((r) => r.title), ['Front Brake Pads for 2019 Toyota Camry'])
  assert.equal(results[0].partNumberMatch, 'related')
})

test('ordinary part searches are not marked as part-number searches', async () => {
  stubEbay({
    models: ['Civic'],
    byFilter: { 'Year:2018;Make:Honda;Model:Civic': [item('Brake Pads for Honda Civic')] },
  })

  const results = await search({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', query: '2018 Honda Civic Brake Pads' })

  assert.equal(results[0].partNumberMatch ?? null, null)
})
