import { createHmac } from 'node:crypto'

export function analyticsHashSecret(env = process.env) {
  const secret = env.ANALYTICS_HASH_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || ''
  return Buffer.byteLength(secret) >= 32 ? secret : null
}

export function visitIdentity(req, sessionId, secret, now = new Date()) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Phoenix',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const hash = (purpose, value) =>
    createHmac('sha256', secret)
      .update(`carpartsradar:analytics:v1:${purpose}:${day}:${value}`)
      .digest('hex')
  // The raw address and user agent never leave this function or enter storage.
  // Rotating the day makes visitors a DAILY estimate, not cross-day identities.
  const address = String(req.ip || req.socket?.remoteAddress || 'unknown')
  const userAgent = String(req.get('user-agent') || '').slice(0, 512)
  return {
    sessionHash: hash('session', sessionId),
    visitorHash: hash('visitor', `${address}\0${userAgent}`),
  }
}
