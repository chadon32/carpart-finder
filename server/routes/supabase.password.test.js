// Password reset with a configured (stubbed) Supabase. Config resolves at import
// time, so the environment is set first; the stub answers only Supabase URLs and
// passes everything else (the local test server) through.
process.env.NODE_ENV = 'development'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_ANON_KEY = 'anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
delete process.env.ALLOW_MOCK_AUTH

import test from 'node:test'
import assert from 'node:assert/strict'

const realFetch = globalThis.fetch
const supabaseCalls = []
let recoverStatus = 200
let userStatus = 200
let adminUpdateStatus = 200

globalThis.fetch = (url, init) => {
  const target = new URL(String(url))
  if (target.origin !== 'https://test.supabase.co') return realFetch(url, init)
  const body = init?.body ? JSON.parse(String(init.body)) : null
  supabaseCalls.push({ method: init?.method ?? 'GET', path: target.pathname, search: target.search, body })
  const json = (payload, status = 200) => Promise.resolve(new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }))
  if (target.pathname === '/auth/v1/recover') return recoverStatus === 200 ? json({}) : json({ msg: 'boom', code: recoverStatus }, recoverStatus)
  if (target.pathname === '/auth/v1/user') {
    return userStatus === 200
      ? json({ id: '8e4a7d6c-1111-4222-8333-444455556666', email: 'driver@example.com', user_metadata: { full_name: 'Driver' } })
      : json({ msg: 'invalid JWT', code: userStatus }, userStatus)
  }
  if (target.pathname.startsWith('/auth/v1/admin/users/')) {
    return adminUpdateStatus === 200
      ? json({ id: '8e4a7d6c-1111-4222-8333-444455556666', email: 'driver@example.com' })
      : json({ msg: 'nope' }, adminUpdateStatus)
  }
  return json({ msg: 'unexpected' }, 404)
}

const { default: app } = await import('../../api/index.js')
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/api/supabase`
test.after(() => {
  server.close()
  globalThis.fetch = realFetch
})

const post = (path, body) => realFetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
// The shared rate limiter also talks to Supabase; only auth calls matter here.
const authCalls = () => supabaseCalls.filter((call) => call.path.startsWith('/auth/v1/'))
const reset = () => {
  supabaseCalls.length = 0
  recoverStatus = 200
  userStatus = 200
  adminUpdateStatus = 200
}

test('asking for a reset link needs a valid email address', async () => {
  reset()
  const res = await post('/password/forgot', { email: 'not-an-email' })
  assert.equal(res.status, 400)
  assert.equal(authCalls().length, 0)
})

test('a reset link is requested from Supabase and the page answers the same way for any address', async () => {
  reset()
  const res = await post('/password/forgot', { email: 'Driver@Example.com' })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { success: true })
  const recover = supabaseCalls.find((call) => call.path === '/auth/v1/recover')
  assert.equal(recover?.body?.email, 'driver@example.com')
  // The link must come back to this site, never to an address the caller chose.
  assert.match(decodeURIComponent(recover.search), /redirect_to=http:\/\/localhost:5173\//)
})

test('a failure at Supabase does not reveal whether the account exists', async () => {
  reset()
  recoverStatus = 400
  const res = await post('/password/forgot', { email: 'nobody@example.com' })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { success: true })
})

test('a new password needs a token and at least 8 characters', async () => {
  reset()
  assert.equal((await post('/password/reset', { password: 'long-enough-1' })).status, 400)
  assert.equal((await post('/password/reset', { access_token: 'tok', password: 'short' })).status, 400)
  assert.equal((await post('/password/reset', { access_token: 'tok', password: 'x'.repeat(129) })).status, 400)
  assert.equal(authCalls().length, 0)
})

test('an expired or forged reset token is refused and changes nothing', async () => {
  reset()
  userStatus = 401
  const res = await post('/password/reset', { access_token: 'forged', password: 'brand-new-password' })
  assert.equal(res.status, 401)
  assert.match((await res.json()).error, /expired|new link/i)
  assert.ok(!supabaseCalls.some((call) => call.path.startsWith('/auth/v1/admin/')))
})

test('a valid reset token sets the new password and signs the person in', async () => {
  reset()
  const res = await post('/password/reset', { access_token: 'valid-recovery-token', password: 'brand-new-password' })
  assert.equal(res.status, 200)
  const payload = await res.json()
  assert.equal(payload.user.email, 'driver@example.com')
  const update = supabaseCalls.find((call) => call.path === '/auth/v1/admin/users/8e4a7d6c-1111-4222-8333-444455556666')
  assert.equal(update?.method, 'PUT')
  assert.equal(update?.body?.password, 'brand-new-password')
  assert.match(res.headers.get('set-cookie') ?? '', /cpf_token=valid-recovery-token/)
})

test('if Supabase rejects the update, the person is told and not signed in', async () => {
  reset()
  adminUpdateStatus = 422
  const res = await post('/password/reset', { access_token: 'valid-recovery-token', password: 'brand-new-password' })
  assert.equal(res.status, 400)
  assert.equal(res.headers.get('set-cookie'), null)
})
