import crypto from 'node:crypto'

const PROOF_VERSION = 1
const DEFAULT_TTL_MS = 30 * 60 * 1000

function proofSecret() {
  if (process.env.FITMENT_PROOF_SECRET) return process.env.FITMENT_PROOF_SECRET
  if (!process.env.EBAY_CLIENT_SECRET) return null

  // Derive a purpose-specific key instead of using the provider credential
  // directly as an HMAC key. FITMENT_PROOF_SECRET remains the preferred
  // production configuration because it can be rotated independently.
  return crypto
    .createHash('sha256')
    .update(`carpartsradar-fitment-proof:${process.env.EBAY_CLIENT_SECRET}`)
    .digest()
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

function normalizedClaim(claim) {
  return {
    v: Number(claim.v ?? PROOF_VERSION),
    listingId: String(claim.listingId ?? ''),
    year: String(claim.year ?? ''),
    make: String(claim.make ?? ''),
    model: String(claim.model ?? ''),
    trim: String(claim.trim ?? ''),
    part: String(claim.part ?? ''),
    source: String(claim.source ?? ''),
    exp: Number(claim.exp),
  }
}

export function issueFitmentProof(claim, { now = Date.now(), ttlMs = DEFAULT_TTL_MS } = {}) {
  const secret = proofSecret()
  if (!secret) return null

  const payload = encode(normalizedClaim({ ...claim, exp: now + ttlMs }))
  return `${payload}.${sign(payload, secret)}`
}

export function verifyFitmentProof(token, expected, { now = Date.now() } = {}) {
  const secret = proofSecret()
  if (!secret || typeof token !== 'string') return false

  const [payload, suppliedSignature, extra] = token.split('.')
  if (!payload || !suppliedSignature || extra) return false

  const expectedSignature = sign(payload, secret)
  const supplied = Buffer.from(suppliedSignature)
  const actual = Buffer.from(expectedSignature)
  if (supplied.length !== actual.length || !crypto.timingSafeEqual(supplied, actual)) return false

  let claim
  try {
    claim = normalizedClaim(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
  } catch {
    return false
  }

  if (claim.v !== PROOF_VERSION || !Number.isFinite(claim.exp) || claim.exp <= now) return false

  const wanted = normalizedClaim({ ...expected, exp: claim.exp })
  return (
    claim.listingId === wanted.listingId &&
    claim.year === wanted.year &&
    claim.make.toLowerCase() === wanted.make.toLowerCase() &&
    claim.model.toLowerCase() === wanted.model.toLowerCase() &&
    claim.trim.toLowerCase() === wanted.trim.toLowerCase() &&
    claim.part.toLowerCase() === wanted.part.toLowerCase() &&
    claim.source.toLowerCase() === wanted.source.toLowerCase()
  )
}
