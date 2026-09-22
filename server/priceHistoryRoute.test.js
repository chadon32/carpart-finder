// /api/price-history shares the production search budget. Until the shared
// limiter migration is applied, every request fails closed with 503.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => server.close())

test('a missing part is rejected', async () => {
  const res = await fetch(`${base}/api/price-history?year=2018&make=Honda&model=Civic`)
  assert.equal(res.status, 503)
})

test('an invalid year is rejected', async () => {
  const res = await fetch(`${base}/api/price-history?year=1492&make=Honda&model=Civic&part=Brake+Pads`)
  assert.equal(res.status, 503)
})

test('a valid request fails closed until the shared limiter is available', async () => {
  const res = await fetch(`${base}/api/price-history?year=2018&make=Honda&model=Civic&part=Brake+Pads`)
  assert.equal(res.status, 503)
  assert.deepEqual(await res.json(), { error: 'Rate limiting is temporarily unavailable. Please try again.' })
})
