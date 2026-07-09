// Mock mode so /login reaches the handler rather than the 503 gate — we are
// testing the limiter, which sits in front of both. Env must be set before the
// app is imported: server/supabase.js resolves its config at import time.
process.env.NODE_ENV = 'development'
process.env.ALLOW_MOCK_AUTH = '1'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => server.close())

test('the 11th login attempt in the window is rate limited', async () => {
  const attempt = () =>
    fetch(`${base}/api/supabase/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'brute@example.com', password: 'wrongpassword' }),
    })

  const statuses = []
  for (let i = 0; i < 11; i++) statuses.push((await attempt()).status)

  assert.ok(!statuses.slice(0, 10).includes(429), `first 10 must not be limited, got ${statuses}`)
  assert.equal(statuses[10], 429, 'the 11th attempt must be limited')
})
