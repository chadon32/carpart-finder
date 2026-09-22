import test from 'node:test'
import assert from 'node:assert/strict'
import { clearLocalRateLimitState, createSharedRateLimiter, rateLimitKey } from './rateLimit.js'

function response() {
  const headers = new Map()
  const result = { statusCode: 200, body: null }
  return {
    result,
    set(name, value) { headers.set(name.toLowerCase(), String(value)); return this },
    status(code) { result.statusCode = code; return this },
    json(body) { result.body = body; return this },
    headers,
  }
}

function request(ip = '203.0.113.10') {
  return { ip, socket: { remoteAddress: ip } }
}

test('two limiter instances share one atomic backend counter', async () => {
  const rows = new Map()
  const calls = []
  const admin = {
    rpc(name, args) {
      calls.push({ name, args })
      assert.equal(name, 'consume_api_rate_limit')
      const prior = rows.get(args.p_key_hash)
      const now = Date.now()
      const windowMs = args.p_window_seconds * 1000
      const current = !prior || now - prior.windowStart >= windowMs
        ? { windowStart: now, count: 0 }
        : prior
      current.count += 1
      rows.set(args.p_key_hash, current)
      const result = Promise.resolve({
        data: [{
          allowed: current.count <= args.p_limit,
          count: current.count,
          reset_at: new Date(current.windowStart + windowMs).toISOString(),
        }],
        error: null,
      })
      result.abortSignal = () => result
      return result
    },
  }
  const options = { name: 'login', windowMs: 60_000, max: 1, message: 'Too many attempts.', admin, production: () => true }
  const first = createSharedRateLimiter(options)
  const second = createSharedRateLimiter(options)
  const req = request()
  const firstResponse = response()
  let firstNext = 0
  await first(req, firstResponse, () => { firstNext += 1 })
  const secondResponse = response()
  let secondNext = 0
  await second(req, secondResponse, () => { secondNext += 1 })

  assert.equal(firstNext, 1)
  assert.equal(firstResponse.result.statusCode, 200)
  assert.equal(secondNext, 0)
  assert.equal(secondResponse.result.statusCode, 429)
  assert.equal(calls[0].args.p_key_hash, calls[1].args.p_key_hash)
  assert.match(calls[0].args.p_key_hash, /^[a-f0-9]{64}$/)
  assert.notEqual(calls[0].args.p_key_hash, req.ip)
})

test('production fails closed when the shared limiter is unavailable', async () => {
  const limiter = createSharedRateLimiter({
    name: 'login',
    windowMs: 60_000,
    max: 1,
    message: 'Too many attempts.',
    failClosed: true,
    admin: { rpc: async () => ({ data: null, error: { code: '42P01' } }) },
    production: () => true,
  })
  const result = response()
  let nextCalls = 0
  await limiter(request(), result, () => { nextCalls += 1 })
  assert.equal(result.result.statusCode, 503)
  assert.deepEqual(result.result.body, { error: 'Rate limiting is temporarily unavailable. Please try again.' })
  assert.equal(nextCalls, 0)
})

test('production fails closed when the shared RPC exceeds its cancellable deadline', async () => {
  let aborted = false
  const limiter = createSharedRateLimiter({
    name: 'login-timeout',
    windowMs: 60_000,
    max: 1,
    message: 'Too many attempts.',
    failClosed: true,
    admin: {
      rpc: () => {
        let rejectPending
        const pending = new Promise((_resolve, reject) => {
          rejectPending = reject
          setTimeout(() => reject(Object.assign(new Error('aborted'), { code: 'ABORT_ERR' })), 1_700)
        })
        pending.abortSignal = (signal) => {
          signal.addEventListener('abort', () => {
            aborted = true
            rejectPending(Object.assign(new Error('aborted'), { code: 'ABORT_ERR' }))
          }, { once: true })
          return pending
        }
        return pending
      },
    },
    production: () => true,
  })
  const result = response()
  let nextCalls = 0
  const started = Date.now()
  await limiter(request(), result, () => { nextCalls += 1 })
  assert.ok(Date.now() - started < 1_650)
  assert.equal(aborted, true)
  assert.equal(result.result.statusCode, 503)
  assert.deepEqual(result.result.body, { error: 'Rate limiting is temporarily unavailable. Please try again.' })
  assert.equal(nextCalls, 0)
})

test('local cleanup uses each bucket window instead of the current limiter window', async () => {
  clearLocalRateLimitState()
  const originalNow = Date.now
  let now = 1_000_000
  Date.now = () => now
  try {
    const long = createSharedRateLimiter({
      name: 'long-window',
      windowMs: 10_000,
      max: 1,
      message: 'Too many attempts.',
      admin: null,
      production: () => false,
    })
    const short = createSharedRateLimiter({
      name: 'short-window',
      windowMs: 1_000,
      max: 1,
      message: 'Too many attempts.',
      admin: null,
      production: () => false,
    })
    const firstLong = response()
    await long(request('198.51.100.200'), firstLong, () => {})
    assert.equal(firstLong.result.statusCode, 200)

    now += 1_500
    // Reach the periodic cleanup point while the long-window bucket is still
    // active. A cleanup based on the short window would incorrectly delete it.
    for (let index = 0; index < 255; index += 1) {
      const shortResult = response()
      await short(request(`198.51.100.${index}:short`), shortResult, () => {})
    }
    const secondLong = response()
    await long(request('198.51.100.200'), secondLong, () => {})
    assert.equal(secondLong.result.statusCode, 429)
  } finally {
    Date.now = originalNow
    clearLocalRateLimitState()
  }
})

test('the local fallback rejects new identities at its hard bucket cap', async () => {
  clearLocalRateLimitState()
  const limiter = createSharedRateLimiter({
    name: 'bounded-local',
    windowMs: 60_000,
    max: 1,
    message: 'Too many attempts.',
    admin: null,
    production: () => false,
  })
  for (let index = 0; index < 10_000; index += 1) {
    const result = response()
    await limiter(request(`198.51.100.${index % 256}:${index}`), result, () => {})
    assert.equal(result.result.statusCode, 200)
  }
  const capped = response()
  await limiter(request('203.0.113.250'), capped, () => {})
  assert.equal(capped.result.statusCode, 503)
  clearLocalRateLimitState()
})

test('client identity key is a one-way bounded hash', () => {
  const key = rateLimitKey(request('198.51.100.9'), 'auth')
  assert.match(key, /^[a-f0-9]{64}$/)
  assert.ok(!key.includes('198.51.100.9'))
})
