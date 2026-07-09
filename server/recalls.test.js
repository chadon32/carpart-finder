// /api/recalls with a stubbed api.nhtsa.gov upstream (pass-through elsewhere).
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const realFetch = globalThis.fetch

function stubRecalls(handler) {
  globalThis.fetch = (url, opts) => {
    if (String(url).includes('api.nhtsa.gov')) return Promise.resolve(handler(String(url)))
    return realFetch(url, opts)
  }
}

const { default: app } = await import('../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => {
  server.close()
  globalThis.fetch = realFetch
})

test('missing params are rejected', async () => {
  const res = await fetch(`${base}/api/recalls?make=Honda&model=Civic`)
  assert.equal(res.status, 400)
})

test('an invalid year is rejected', async () => {
  const res = await fetch(`${base}/api/recalls?year=1492&make=Honda&model=Civic`)
  assert.equal(res.status, 400)
})

test('recalls are mapped to the app shape', async () => {
  stubRecalls(() =>
    new Response(
      JSON.stringify({
        Count: 1,
        results: [{
          NHTSACampaignNumber: '23V123000',
          Component: 'FUEL SYSTEM, GASOLINE',
          Summary: 'Fuel pump may fail.',
          Consequence: 'Engine stall increases crash risk.',
          Remedy: 'Dealers replace the fuel pump free of charge.',
          ReportReceivedDate: '01/05/2023',
        }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  )
  const res = await fetch(`${base}/api/recalls?year=2019&make=Honda&model=CR-V`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.recalls, [{
    campaignNumber: '23V123000',
    component: 'FUEL SYSTEM, GASOLINE',
    summary: 'Fuel pump may fail.',
    consequence: 'Engine stall increases crash risk.',
    remedy: 'Dealers replace the fuel pump free of charge.',
    reportedDate: '01/05/2023',
  }])
})

test('no recalls returns an empty array, not an error', async () => {
  stubRecalls(() =>
    new Response(JSON.stringify({ Count: 0, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
  const res = await fetch(`${base}/api/recalls?year=2024&make=Toyota&model=Camry`)
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).recalls, [])
})

test('an upstream failure returns 502', async () => {
  // 400 is non-retryable, so this fails fast without burning retry backoff.
  stubRecalls(() => new Response('bad', { status: 400 }))
  const res = await fetch(`${base}/api/recalls?year=2018&make=Ford&model=F-150`)
  assert.equal(res.status, 502)
})

test('results are cached per vehicle (second call skips upstream)', async () => {
  let calls = 0
  stubRecalls(() => {
    calls++
    return new Response(JSON.stringify({ Count: 0, results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  await fetch(`${base}/api/recalls?year=2021&make=Subaru&model=Outback`)
  await fetch(`${base}/api/recalls?year=2021&make=Subaru&model=Outback`)
  assert.equal(calls, 1)
})
