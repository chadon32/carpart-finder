import { createHash } from 'node:crypto'
import { supabaseAdmin, isMockMode } from './supabase.js'

const localBuckets = new Map()
const MAX_LOCAL_BUCKETS = 10_000
const RPC_TIMEOUT_MS = 1_500
let localCleanupTick = 0

function nowMs() {
  return Date.now()
}

function localConsume(key, windowMs, max) {
  const now = nowMs()
  // Remove expired identities before enforcing the hard cap. This keeps the
  // offline fallback bounded even when traffic arrives under many identities.
  localCleanupTick += 1
  if (localBuckets.size >= MAX_LOCAL_BUCKETS || localCleanupTick % 256 === 0) {
    for (const [candidate, value] of localBuckets) {
      if (value.expiresAt <= now) localBuckets.delete(candidate)
    }
  }

  const current = localBuckets.get(key)
  if (!current && localBuckets.size >= MAX_LOCAL_BUCKETS) {
    return { available: false }
  }
  const bucket = !current || now >= current.expiresAt
    ? { windowStart: now, expiresAt: now + windowMs, count: 0 }
    : current
  bucket.count += 1
  localBuckets.set(key, bucket)

  return {
    available: true,
    allowed: bucket.count <= max,
    count: bucket.count,
    resetAt: bucket.expiresAt,
  }
}

/**
 * Hash the request identity before it is sent to the database. The raw IP is
 * never persisted or included in rate-limit diagnostics.
 */
export function rateLimitKey(req, name) {
  const address = String(req.ip || req.socket?.remoteAddress || 'unknown')
  return createHash('sha256')
    .update(`carpartsradar:rate-limit:v1\0${name}\0${address}`)
    .digest('hex')
}

function responseHeaders(res, { count, resetAt, max }) {
  const remaining = Math.max(0, max - count)
  res.set('RateLimit-Limit', String(max))
  res.set('RateLimit-Remaining', String(remaining))
  res.set('RateLimit-Reset', String(Math.max(0, Math.ceil((resetAt - nowMs()) / 1000))))
}

function unavailable(res) {
  return res.status(503).json({ error: 'Rate limiting is temporarily unavailable. Please try again.' })
}

function safeErrorCode(error) {
  const code = error && typeof error.code === 'string' ? error.code : ''
  return /^[A-Za-z0-9:_-]{1,32}$/.test(code) ? code : 'unknown'
}

function localMiddleware({ key, windowMs, max, message }, req, res, next) {
  const result = localConsume(key, windowMs, max)
  if (!result.available) return unavailable(res)
  responseHeaders(res, { ...result, max })
  if (!result.allowed) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - nowMs()) / 1000))))
    return res.status(429).json({ error: message })
  }
  return next()
}

/**
 * A persistent limiter for Vercel/serverless instances. Strict production
 * routes set failClosed=true and never fall back to a process-local map: the
 * SQL RPC is the shared atomic store. Local development keeps a bounded
 * memory bucket so offline tests remain deterministic; read-only routes may
 * explicitly opt into that soft fallback when the shared migration is absent.
 */
export function createSharedRateLimiter({
  name,
  windowMs,
  max,
  message,
  admin = supabaseAdmin,
  failClosed = false,
  production = () => process.env.NODE_ENV === 'production',
}) {
  if (!name || !Number.isInteger(windowMs) || windowMs < 1000 || !Number.isInteger(max) || max < 1) {
    throw new Error('Invalid rate limiter configuration')
  }

  return async function sharedRateLimiter(req, res, next) {
    const keyHash = rateLimitKey(req, name)
    const isProduction = production()

    // The explicit local/mock mode is intentionally offline and may use the
    // bounded process-local path. Production must not silently do this.
    if (!isProduction && (!admin || isMockMode)) {
      return localMiddleware({ key: `${name}:${keyHash}`, windowMs, max, message }, req, res, next)
    }

    if (!admin) {
      if (failClosed) return unavailable(res)
      return localMiddleware({ key: `${name}:${keyHash}`, windowMs, max, message }, req, res, next)
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
      try {
        let request = admin.rpc('consume_api_rate_limit', {
          p_key_hash: keyHash,
          p_window_seconds: Math.round(windowMs / 1000),
          p_limit: max,
        })
        // Supabase's PostgREST builder supports abortSignal(), which cancels
        // the in-flight HTTP request when the limiter deadline expires.
        // Requiring a cancellable builder in production avoids a Promise.race
        // that leaves a socket running after a failed-closed response.
        if (typeof request?.abortSignal === 'function') {
          request = request.abortSignal(controller.signal)
        } else if (isProduction && failClosed) {
          throw new Error('Shared rate-limit RPC does not support cancellation')
        }
        const result = await request
        if (result?.error || !result?.data) throw result?.error || new Error('Shared rate-limit response missing')
        const row = Array.isArray(result.data) ? result.data[0] : result.data
        if (!row || typeof row.allowed !== 'boolean' || !Number.isFinite(Number(row.count)) || !row.reset_at) {
          throw new Error('Shared rate-limit response invalid')
        }
        const count = Number(row.count)
        const resetAt = Date.parse(String(row.reset_at))
        if (!Number.isFinite(resetAt)) throw new Error('Shared rate-limit reset is invalid')
        responseHeaders(res, { count, resetAt, max })
        if (!row.allowed) {
          res.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - nowMs()) / 1000))))
          return res.status(429).json({ error: message })
        }
        return next()
      } finally {
        clearTimeout(timeout)
      }
    } catch (error) {
      // A developer can still run the app offline with a real-looking local
      // env file while the optional migration is absent. Preserve that local
      // workflow; a production request receives an explicit 503 instead.
      if (!isProduction || !failClosed) {
        return localMiddleware({ key: `${name}:${keyHash}`, windowMs, max, message }, req, res, next)
      }
      console.error('[rate-limit] shared store unavailable', {
        limiter: name,
        errorCode: safeErrorCode(error),
      })
      return unavailable(res)
    }
  }
}

export function clearLocalRateLimitState() {
  localBuckets.clear()
  localCleanupTick = 0
}
