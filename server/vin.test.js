// /api/vin with a stubbed vPIC upstream. The stub passes through every other
// URL because these tests reach the local Express server via fetch.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const realFetch = globalThis.fetch

function stubVpic(resultsRow) {
  globalThis.fetch = (url, opts) => {
    if (String(url).includes('vpic.nhtsa.dot.gov')) {
      return Promise.resolve(
        new Response(JSON.stringify({ Results: [resultsRow] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
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

test('a missing vin is rejected', async () => {
  const res = await fetch(`${base}/api/vin`)
  assert.equal(res.status, 400)
})

test('a short vin is rejected', async () => {
  const res = await fetch(`${base}/api/vin?vin=1HGCM8263`)
  assert.equal(res.status, 400)
})

test('a vin containing I, O, or Q is rejected', async () => {
  const res = await fetch(`${base}/api/vin?vin=IHGCM82633A004352`)
  assert.equal(res.status, 400)
})

test('a decodable vin returns the mapped vehicle', async () => {
  stubVpic({
    ModelYear: '2018',
    Make: 'HONDA',
    Model: 'Civic',
    Trim: 'EX',
    DisplacementL: '1.5',
    EngineCylinders: '4',
    DriveType: 'FWD/Front-Wheel Drive',
    FuelTypePrimary: 'Gasoline',
  })
  const res = await fetch(`${base}/api/vin?vin=1HGCM82633A004352`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, {
    year: '2018',
    make: 'HONDA',
    model: 'Civic',
    trim: 'EX',
    engine: { displacementL: '1.5', cylinders: '4', driveType: 'FWD/Front-Wheel Drive', fuelType: 'Gasoline' },
  })
})

test('a vin vPIC cannot decode returns 422, not fabricated fields', async () => {
  stubVpic({ ModelYear: '', Make: '', Model: '', ErrorCode: '8' })
  const res = await fetch(`${base}/api/vin?vin=5YJ3E1EA7KF317000`)
  assert.equal(res.status, 422)
})

test('decodes are cached per vin (second call skips upstream)', async () => {
  let calls = 0
  globalThis.fetch = (url, opts) => {
    if (String(url).includes('vpic.nhtsa.dot.gov')) {
      calls++
      return Promise.resolve(
        new Response(JSON.stringify({ Results: [{ ModelYear: '2020', Make: 'TOYOTA', Model: 'Camry' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    return realFetch(url, opts)
  }
  await fetch(`${base}/api/vin?vin=4T1B11HK5KU700001`)
  await fetch(`${base}/api/vin?vin=4T1B11HK5KU700001`)
  assert.equal(calls, 1)
})
