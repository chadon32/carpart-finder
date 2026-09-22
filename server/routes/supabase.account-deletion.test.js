// Route-level proof of the lost-response recovery contract. Mock auth keeps
// the test deterministic while exercising the real Express middleware order,
// signed receipt, destructive route, cookie clearing, and public status route.
process.env.NODE_ENV = 'development'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
process.env.ALLOW_MOCK_AUTH = '1'

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}/api/supabase`
test.after(() => server.close())

async function jsonRequest(path, { method = 'POST', body = {}, cookie } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

test('a deletion receipt confirms success after the authenticated account is already gone', async () => {
  const signup = await jsonRequest('/signup', {
    body: { email: 'receipt-test@example.com', password: 'correct-horse-battery-staple' },
  })
  assert.equal(signup.status, 200)
  const cookie = signup.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie)

  const intent = await jsonRequest('/account/deletion-intent', {
    cookie,
    body: { confirmation: 'DELETE' },
  })
  assert.equal(intent.status, 200)
  const { receipt } = await intent.json()
  assert.equal(typeof receipt, 'string')

  const deletion = await jsonRequest('/account', {
    method: 'DELETE',
    cookie,
    body: { confirmation: 'DELETE', receipt },
  })
  assert.equal(deletion.status, 200)

  // No auth cookie is sent: this is the exact recovery path used after Auth
  // deletion invalidates the session before the final response reaches a user.
  const status = await jsonRequest('/account/deletion-status', {
    body: { receipt },
  })
  assert.equal(status.status, 200)
  assert.deepEqual(await status.json(), { success: true, deleted: true })
  assert.match(status.headers.get('set-cookie') ?? '', /cpf_token=/)
})

test('the status route rejects a forged receipt', async () => {
  const status = await jsonRequest('/account/deletion-status', {
    body: { receipt: 'forged.receipt' },
  })
  assert.equal(status.status, 400)
  assert.match((await status.json()).error, /expired|start account deletion/i)
})
