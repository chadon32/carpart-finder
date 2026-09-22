import crypto from 'node:crypto'

const RECEIPT_VERSION = 1
const DEFAULT_TTL_MS = 15 * 60 * 1000
const MAX_RECEIPT_LENGTH = 2048
const MAX_USER_ID_LENGTH = 128
const DEV_RECEIPT_SECRET = crypto.randomBytes(32)

function receiptSecret(env = process.env) {
  const configured = String(
    env.ACCOUNT_DELETION_RECEIPT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || ''
  ).trim()

  if (Buffer.byteLength(configured) >= 32) {
    return crypto
      .createHash('sha256')
      .update('carpartsradar:account-deletion-receipt:v1\0')
      .update(configured)
      .digest()
  }

  // Local mock-auth and unit tests still need receipts. Production account
  // routes already fail closed without the service-role key, so a process-only
  // development key can never become a production deletion capability.
  return env.NODE_ENV === 'production' ? null : DEV_RECEIPT_SECRET
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function isValidUserId(userId) {
  return typeof userId === 'string' && userId.length > 0 && userId.length <= MAX_USER_ID_LENGTH
}

export function createAccountDeletionReceipt(
  userId,
  { env = process.env, now = Date.now(), ttlMs = DEFAULT_TTL_MS, nonce } = {}
) {
  const secret = receiptSecret(env)
  if (!secret || !isValidUserId(userId)) return null

  const safeTtl = Number.isFinite(ttlMs) && ttlMs > 0
    ? Math.min(ttlMs, DEFAULT_TTL_MS)
    : DEFAULT_TTL_MS
  const claims = {
    v: RECEIPT_VERSION,
    sub: userId,
    exp: now + safeTtl,
    nonce: nonce || crypto.randomBytes(16).toString('base64url'),
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function verifyAccountDeletionReceipt(
  receipt,
  { env = process.env, now = Date.now(), expectedUserId } = {}
) {
  if (typeof receipt !== 'string' || receipt.length === 0 || receipt.length > MAX_RECEIPT_LENGTH) {
    return null
  }

  const secret = receiptSecret(env)
  const parts = receipt.split('.')
  if (!secret || parts.length !== 2) return null

  const [payload, suppliedSignature] = parts
  const expectedSignature = sign(payload, secret)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (
      claims?.v !== RECEIPT_VERSION
      || !isValidUserId(claims.sub)
      || !Number.isFinite(claims.exp)
      || claims.exp <= now
      || claims.exp > now + DEFAULT_TTL_MS
      || typeof claims.nonce !== 'string'
      || !/^[A-Za-z0-9_-]{16,64}$/.test(claims.nonce)
      || (expectedUserId && claims.sub !== expectedUserId)
    ) {
      return null
    }
    return { userId: claims.sub, expiresAt: claims.exp }
  } catch {
    return null
  }
}

export const ACCOUNT_DELETION_RECEIPT_TTL_MS = DEFAULT_TTL_MS
