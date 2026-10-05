import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import express from 'express'
import { createOwnerAnalyticsRouter } from './ownerAnalytics.js'
import { hashOwnerPassword, ownerConfig, createOwnerSession } from '../lib/ownerAuth.js'
import { validateVisitBatch, visitSource, VISIT_BATCH_LIMIT } from '../../shared/visitAnalytics.mjs'

const config = ownerConfig({
  OWNER_EMAIL: 'owner@example.test',
  OWNER_PASSWORD_HASH: await hashOwnerPassword('owner-password-123!'),
  OWNER_SESSION_SECRET: 's'.repeat(48),
})
const calls = []
let dbError = false
let configured = true
const report = { version: 1, days: 30, totals: { visits: 1 }, funnel: [] }
const ready = (result) => {
  const promise = Promise.resolve(result)
  promise.abortSignal = () => promise
  return promise
}
const admin = {
  from(table) {
    assert.equal(table, 'website_analytics_events')
    return {
      upsert(rows, options) {
        calls.push({ rows, options })
        return ready({ error: dbError ? { code: 'missing-table' } : null })
      },
    }
  },
  rpc(name, args) {
    calls.push({ name, args })
    return ready({ data: report, error: dbError ? { code: 'missing-function' } : null })
  },
}
const budgets = []
const app = express()
app.use(express.json())
app.use(
  '/api',
  createOwnerAnalyticsRouter({
    admin,
    getConfig: () => (configured ? config : null),
    getHashSecret: () => 'h'.repeat(48),
    limiterFactory: (options) => {
      budgets.push(options)
      return (_req, _res, next) => next()
    },
  }),
)
const server = app.listen(0, '127.0.0.1')
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}`
test.after(() => server.close())
test.beforeEach(() => {
  calls.length = 0
  dbError = false
  configured = true
})
const cookie = () => `cpf_owner_session=${createOwnerSession(config)}`
const packet = () => ({
  sessionId: randomUUID(),
  device: 'phone',
  source: 'direct',
  events: [{ id: randomUUID(), name: 'Page Viewed', properties: { page: 'home' } }],
})
const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      origin: base,
      'user-agent': 'Mozilla/5.0',
      ...headers,
    },
    body: JSON.stringify(body),
  })

test('first-party batches strip raw search, account, URL, and IP-like properties', async () => {
  const input = packet()
  input.events[0].properties.email = 'driver@example.test'
  input.events[0].properties.vin = '1HGCM82633A004352'
  input.events[0].properties.url = 'https://example.test/private'
  const response = await post('/api/analytics/events', input)
  assert.equal(response.status, 204)
  const { rows, options } = calls[0]
  assert.deepEqual(rows[0].properties, { page: 'home' })
  assert.equal(rows[0].occurred_at, undefined)
  assert.equal(rows[0].session_hash.includes(input.sessionId), false)
  assert.deepEqual(options, { onConflict: 'event_id', ignoreDuplicates: true })
  assert.equal(response.headers.get('cache-control'), 'no-store')
})
test('unknown events, broken IDs, oversized batches and invalid metadata cannot enter analytics', async () => {
  for (const change of [
    (v) => {
      v.events[0].name = 'raw-input'
    },
    (v) => {
      v.sessionId = 'not-a-uuid'
    },
    (v) => {
      v.device = 'user@example.test'
    },
    (v) => {
      v.source = 'https://private.test'
    },
    (v) => {
      v.events = Array.from({ length: VISIT_BATCH_LIMIT + 1 }, () => v.events[0])
    },
  ]) {
    const input = packet()
    change(input)
    assert.equal((await post('/api/analytics/events', input)).status, 400)
  }
  assert.equal(calls.length, 0)
  assert.equal(validateVisitBatch(null), null)
})
test('known automation and privacy opt-outs do not create analytics records', async () => {
  for (const headers of [{ 'user-agent': 'Googlebot' }, { dnt: '1' }, { 'sec-gpc': '1' }])
    assert.equal((await post('/api/analytics/events', packet(), headers)).status, 204)
  assert.equal(calls.length, 0)
})
test('analytics storage failures are unavailable, not successful writes or zero reports', async () => {
  dbError = true
  assert.equal((await post('/api/analytics/events', packet())).status, 503)
  const response = await fetch(`${base}/api/admin/analytics`, { headers: { cookie: cookie() } })
  assert.equal(response.status, 503)
  assert.equal((await response.json()).totals, undefined)
})
test('shopper cookies, missing owner credentials, and forged sessions cannot read analytics', async () => {
  for (const headers of [
    {},
    { cookie: 'cpf_token=shopper@example.test' },
    { cookie: 'cpf_owner_session=owner@example.test' },
  ])
    assert.equal((await fetch(`${base}/api/admin/analytics`, { headers })).status, 401)
  assert.equal(calls.length, 0)
})
test('owner login issues a scoped HttpOnly session and logout clears it', async () => {
  const response = await post('/api/admin/login', {
    email: 'owner@example.test',
    password: 'owner-password-123!',
  })
  assert.equal(response.status, 200)
  const setCookie = response.headers.get('set-cookie')
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /SameSite=Strict/)
  assert.match(setCookie, /Path=\/api\/admin/)
  const session = await fetch(`${base}/api/admin/session`, {
    headers: { cookie: setCookie.split(';')[0] },
  })
  assert.equal((await session.json()).authenticated, true)
  const logout = await post('/api/admin/logout', {})
  assert.equal(logout.status, 200)
  assert.match(logout.headers.get('set-cookie'), /cpf_owner_session=;/)
})
test('owner login is rejected for wrong credentials, cross-site requests, and missing setup', async () => {
  assert.equal(
    (
      await post('/api/admin/login', {
        email: 'other@example.test',
        password: 'owner-password-123!',
      })
    ).status,
    401,
  )
  assert.equal((await post('/api/admin/login', {}, { origin: 'https://evil.test' })).status, 403)
  assert.equal((await post('/api/admin/logout', {}, { origin: 'https://evil.test' })).status, 403)
  configured = false
  assert.equal((await post('/api/admin/login', {})).status, 503)
  const session = await fetch(`${base}/api/admin/session`)
  assert.deepEqual(await session.json(), { authenticated: false, configured: false })
})
test('aggregate reads are authenticated, range bounded, and service-role only', async () => {
  const response = await fetch(`${base}/api/admin/analytics?days=30`, {
    headers: { cookie: cookie() },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), report)
  assert.deepEqual(calls[0], { name: 'website_analytics_summary', args: { p_days: 30 } })
  assert.equal(
    (await fetch(`${base}/api/admin/analytics?days=1000`, { headers: { cookie: cookie() } }))
      .status,
    400,
  )
  assert.equal(
    budgets.every((budget) => budget.failClosed === true),
    true,
  )
  assert.deepEqual(
    budgets.map((budget) => budget.name),
    ['analytics-ingest', 'owner-login', 'owner-analytics-read'],
  )
})
test('traffic sources use coarse host buckets without retaining referral URLs', () => {
  assert.equal(
    visitSource('https://www.google.com/search?q=private', 'https://carpartsradar.com'),
    'search',
  )
  assert.equal(
    visitSource('https://instagram.com/private-user', 'https://carpartsradar.com'),
    'social',
  )
  assert.equal(
    visitSource('https://carpartsradar.com/guides.html?email=private', 'https://carpartsradar.com'),
    'direct',
  )
  assert.equal(visitSource('https://example.test/private', 'https://carpartsradar.com'), 'referral')
})
