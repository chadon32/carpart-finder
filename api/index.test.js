// Production, accounts disabled — the same shape as the live deploy.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('./index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => server.close())

test('an unknown route returns a 404 JSON body, not HTML', async () => {
  const res = await fetch(`${base}/api/does-not-exist`)
  assert.equal(res.status, 404)
  assert.match(res.headers.get('content-type') ?? '', /application\/json/)
  assert.equal((await res.json()).error, 'Not found')
})

test('malformed JSON returns 400 JSON, not an HTML stack page', async () => {
  const res = await fetch(`${base}/api/ai/repair-guide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ this is not json',
  })
  assert.equal(res.status, 400)
  assert.match(res.headers.get('content-type') ?? '', /application\/json/)
  const body = await res.json()
  assert.equal(body.error, 'Malformed JSON body')
})

test('a disallowed Origin gets 403, not 500', async () => {
  const res = await fetch(`${base}/api/search?year=2018&make=Honda&model=Civic&part=Brake+Pads`, {
    headers: { Origin: 'https://evil.example' },
  })
  assert.equal(res.status, 403)
  assert.equal((await res.json()).error, 'Origin not allowed')
})

test('an allowed Origin is not blocked', async () => {
  // Reaches the handler; without eBay keys it returns 502/200, never 403.
  const res = await fetch(`${base}/api/search?year=2018&make=Honda`, {
    headers: { Origin: 'https://carpartsradar.com' },
  })
  assert.notEqual(res.status, 403)
})

test('a request with no Origin (curl, server-to-server) is not blocked', async () => {
  const res = await fetch(`${base}/api/search?year=2018&make=Honda`)
  assert.equal(res.status, 400) // reached the handler: missing `part`
})

test('over-long ids on /api/prices are rejected', async () => {
  const ids = Array.from({ length: 21 }, (_, i) => `ebay-${i}`).join(',')
  const res = await fetch(`${base}/api/prices?ids=${ids}`)
  assert.equal(res.status, 400)
})

test('an over-long make on /api/vehicle-image is rejected', async () => {
  const long = 'a'.repeat(61)
  const res = await fetch(`${base}/api/vehicle-image?make=${long}&model=Civic`)
  assert.equal(res.status, 400)
})

test('an invalid year on /api/vehicle-image is rejected', async () => {
  const res = await fetch(`${base}/api/vehicle-image?make=Honda&model=Civic&year=1492`)
  assert.equal(res.status, 400)
})
