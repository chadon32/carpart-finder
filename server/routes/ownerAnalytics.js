import express from 'express'
import { supabaseAdmin } from '../supabase.js'
import { createSharedRateLimiter } from '../rateLimit.js'
import { validateVisitBatch } from '../../shared/visitAnalytics.mjs'
import { analyticsHashSecret, visitIdentity } from '../lib/visitIdentity.js'
import {
  ownerConfig,
  verifyOwnerPassword,
  createOwnerSession,
  verifyOwnerSession,
  readOwnerCookie,
  ownerCookieOptions,
  ownerWriteOriginAllowed,
  OWNER_COOKIE,
} from '../lib/ownerAuth.js'

const timeoutSignal = () => AbortSignal.timeout(5000)
const withTimeout = (query) =>
  typeof query.abortSignal === 'function' ? query.abortSignal(timeoutSignal()) : query
const unavailable = (res) =>
  res
    .status(503)
    .json({
      error:
        'Analytics storage is not ready. Apply the analytics migration and configure the server database.',
    })

export function createOwnerAnalyticsRouter({
  admin = supabaseAdmin,
  getConfig = ownerConfig,
  getHashSecret = analyticsHashSecret,
  limiterFactory = createSharedRateLimiter,
} = {}) {
  const router = express.Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    res.set('X-Robots-Tag', 'noindex, nofollow')
    next()
  })
  const budget = (name, max) =>
    limiterFactory({
      name,
      windowMs: 15 * 60 * 1000,
      max,
      admin,
      failClosed: true,
      message: 'Too many requests. Please try again in a few minutes.',
    })
  const ingestLimiter = budget('analytics-ingest', 300)
  const loginLimiter = budget('owner-login', 10)
  const readLimiter = budget('owner-analytics-read', 60)

  router.post('/analytics/events', ingestLimiter, async (req, res) => {
    if (
      Number(req.get('content-length') || 0) > 16_384 ||
      JSON.stringify(req.body || {}).length > 16_384
    )
      return res.status(413).json({ error: 'Analytics batch too large.' })
    const batch = validateVisitBatch(req.body)
    if (!batch) return res.status(400).json({ error: 'Invalid analytics batch.' })
    if (
      /bot|crawl|spider|headless|playwright|puppeteer/i.test(req.get('user-agent') || '') ||
      req.get('dnt') === '1' ||
      req.get('sec-gpc') === '1'
    )
      return res.sendStatus(204)
    const secret = getHashSecret()
    if (!admin || !secret) return unavailable(res)
    const identity = visitIdentity(req, batch.sessionId, secret)
    const rows = batch.events.map((event) => ({
      event_id: event.id,
      session_hash: identity.sessionHash,
      visitor_hash: identity.visitorHash,
      event_name: event.name,
      properties: event.properties,
      device: batch.device,
      source: batch.source,
    }))
    try {
      // Idempotent IDs make retries safe. Never overwrite server timestamps.
      const { error } = await withTimeout(
        admin
          .from('website_analytics_events')
          .upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true }),
      )
      if (error) return unavailable(res)
      return res.sendStatus(204)
    } catch {
      return unavailable(res)
    }
  })

  function writeOrigin(req, res, next) {
    if (!ownerWriteOriginAllowed(req))
      return res.status(403).json({ error: 'Owner request origin is not allowed.' })
    next()
  }
  function authenticated(req, res, next) {
    const config = getConfig()
    if (!config)
      return res.status(503).json({ error: 'Owner access is not configured on the server.' })
    if (!verifyOwnerSession(readOwnerCookie(req), config))
      return res.status(401).json({ error: 'Owner sign-in is required.' })
    next()
  }
  router.post('/admin/login', writeOrigin, loginLimiter, async (req, res) => {
    const config = getConfig()
    if (!config)
      return res.status(503).json({ error: 'Owner access is not configured on the server.' })
    try {
      if (!(await verifyOwnerPassword(req.body?.email, req.body?.password, config)))
        return res.status(401).json({ error: 'Invalid owner email or password.' })
      res.cookie(OWNER_COOKIE, createOwnerSession(config), ownerCookieOptions())
      res.json({ authenticated: true })
    } catch {
      res.status(503).json({ error: 'Owner sign-in is temporarily unavailable.' })
    }
  })
  router.post('/admin/logout', writeOrigin, (_req, res) => {
    const { maxAge: _maxAge, ...options } = ownerCookieOptions()
    res.clearCookie(OWNER_COOKIE, options)
    res.json({ authenticated: false })
  })
  router.get('/admin/session', (req, res) => {
    const config = getConfig()
    res.json({
      authenticated: Boolean(config && verifyOwnerSession(readOwnerCookie(req), config)),
      configured: Boolean(config),
    })
  })
  router.get('/admin/analytics', authenticated, readLimiter, async (req, res) => {
    const days = Number(req.query.days ?? 30)
    if (!['7', '30', '90'].includes(String(req.query.days ?? 30)))
      return res.status(400).json({ error: 'Choose a 7, 30, or 90 day range.' })
    if (!admin) return unavailable(res)
    try {
      const { data, error } = await withTimeout(
        admin.rpc('website_analytics_summary', { p_days: days }),
      )
      if (error || !data || data.version !== 1 || !data.totals || !Array.isArray(data.funnel))
        return unavailable(res)
      res.json(data)
    } catch {
      unavailable(res)
    }
  })
  return router
}

export default createOwnerAnalyticsRouter()
