import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
export const OWNER_COOKIE = 'cpf_owner_session'
export const OWNER_SESSION_MS = 8 * 60 * 60 * 1000
const HASH_FORMAT = /^scrypt\$16384\$8\$1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/

function parsedHash(hash) {
  const match = typeof hash === 'string' && HASH_FORMAT.exec(hash)
  if (!match) return null
  const salt = Buffer.from(match[1], 'base64url')
  const digest = Buffer.from(match[2], 'base64url')
  return salt.length === 16 && digest.length === 32 ? { salt, digest } : null
}

export async function hashOwnerPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 256) {
    throw new Error('Use an owner password of 12–256 bytes.')
  }
  const salt = randomBytes(16)
  const digest = await scrypt(password, salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  })
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`
}

export function ownerConfig(env = process.env) {
  const email = String(env.OWNER_EMAIL || '')
    .trim()
    .toLowerCase()
  const passwordHash = env.OWNER_PASSWORD_HASH || ''
  const secret = env.OWNER_SESSION_SECRET || ''
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !parsedHash(passwordHash) ||
    Buffer.byteLength(secret) < 32
  )
    return null
  return { email, passwordHash, secret }
}

export async function verifyOwnerPassword(email, password, config) {
  if (!config || typeof password !== 'string' || Buffer.byteLength(password) > 256) return false
  const parsed = parsedHash(config.passwordHash)
  if (!parsed) return false
  // Derive even for the wrong email; no owner-email enumeration shortcut.
  const digest = await scrypt(password, parsed.salt, 32, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  })
  return (
    timingSafeEqual(parsed.digest, digest) &&
    typeof email === 'string' &&
    email.trim().toLowerCase() === config.email
  )
}

function sign(payload, config) {
  return createHmac('sha256', config.secret)
    .update(`carpartsradar:owner:v1:${config.email}:${payload}`)
    .digest('base64url')
}

export function createOwnerSession(config, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      iat: now,
      exp: now + OWNER_SESSION_MS,
      nonce: randomBytes(16).toString('hex'),
    }),
  ).toString('base64url')
  return `${payload}.${sign(payload, config)}`
}

export function verifyOwnerSession(value, config, now = Date.now()) {
  if (!config || typeof value !== 'string' || value.length > 512) return false
  const parts = value.split('.')
  if (
    parts.length !== 2 ||
    !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[1])
  )
    return false
  const expected = Buffer.from(sign(parts[0], config))
  const actual = Buffer.from(parts[1])
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
  try {
    const claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    return (
      claims.v === 1 &&
      Number.isSafeInteger(claims.iat) &&
      Number.isSafeInteger(claims.exp) &&
      claims.iat <= now &&
      claims.exp > now &&
      claims.exp === claims.iat + OWNER_SESSION_MS &&
      /^[a-f0-9]{32}$/.test(claims.nonce)
    )
  } catch {
    return false
  }
}

export function readOwnerCookie(req) {
  const parts = String(req.headers.cookie || '').split(';')
  const cookie = parts.find((value) => value.trim().startsWith(`${OWNER_COOKIE}=`))
  if (!cookie) return ''
  try {
    return decodeURIComponent(cookie.trim().slice(OWNER_COOKIE.length + 1))
  } catch {
    return ''
  }
}

export function ownerCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: OWNER_SESSION_MS,
  }
}

export function ownerWriteOriginAllowed(req) {
  const origin = req.get('origin')
  const allowed = ['https://carpartsradar.com', 'https://www.carpartsradar.com']
  if (process.env.FRONTEND_URL) {
    try {
      allowed.push(new URL(process.env.FRONTEND_URL).origin)
    } catch {
      /* Fail closed. */
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    try {
      const requestUrl = new URL(`${req.protocol}://${req.get('host')}`)
      if (['localhost', '127.0.0.1', '[::1]'].includes(requestUrl.hostname))
        allowed.push(requestUrl.origin)
    } catch {
      /* Fail closed. */
    }
  }
  return typeof origin === 'string' && allowed.includes(origin)
}
