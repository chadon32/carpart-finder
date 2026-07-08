// Simulates the exact production state that shipped: NODE_ENV=production with
// no Supabase configuration. Env is set BEFORE importing the app, because
// server/supabase.js resolves its config at import time. dotenv does not
// override already-set vars, so the empty strings below win over any .env.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
process.env.ALLOW_MOCK_AUTH = '1' // proves production ignores the opt-in

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => server.close())

const postJson = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

test('login is refused with 503, not a forged session', async () => {
  const res = await postJson('/api/supabase/login', { email: 'a@b.com', password: 'anything' })
  assert.equal(res.status, 503)
  assert.equal(res.headers.get('set-cookie'), null)
})

test('signup is refused with 503', async () => {
  const res = await postJson('/api/supabase/signup', { email: 'a@b.com', password: 'anything' })
  assert.equal(res.status, 503)
})

// The bypass: previously, presenting an arbitrary email as the cookie value
// authenticated the request as that user.
test('a forged cpf_token cookie cannot authenticate', async () => {
  const res = await fetch(`${base}/api/supabase/me`, {
    headers: { cookie: 'cpf_token=victim@example.com' },
  })
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.user, undefined)
})

test('the public guest-alert subscribe is also gated', async () => {
  const res = await postJson('/api/supabase/price-alerts/subscribe', {
    email: 'a@b.com', year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', target_price: 50,
  })
  assert.equal(res.status, 503)
})

// Exempt: this is how stale mock cookies get cleared.
test('logout still succeeds and clears the cookie', async () => {
  const res = await postJson('/api/supabase/logout', {})
  assert.equal(res.status, 200)
  assert.match(res.headers.get('set-cookie') ?? '', /cpf_token=/)
})

// The product must stay up. Search needs no database.
test('the search endpoint still validates input rather than 503ing', async () => {
  const res = await fetch(`${base}/api/search?year=2018&make=Honda`)
  assert.equal(res.status, 400) // missing `part` — reached the handler, not the gate
})
