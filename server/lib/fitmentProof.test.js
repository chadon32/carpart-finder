import test from 'node:test'
import assert from 'node:assert/strict'
import { issueFitmentProof, verifyFitmentProof } from './fitmentProof.js'

const originalProofSecret = process.env.FITMENT_PROOF_SECRET
const originalEbaySecret = process.env.EBAY_CLIENT_SECRET

test.beforeEach(() => {
  process.env.FITMENT_PROOF_SECRET = 'test-only-fitment-secret-with-enough-entropy'
  delete process.env.EBAY_CLIENT_SECRET
})

test.after(() => {
  if (originalProofSecret === undefined) delete process.env.FITMENT_PROOF_SECRET
  else process.env.FITMENT_PROOF_SECRET = originalProofSecret
  if (originalEbaySecret === undefined) delete process.env.EBAY_CLIENT_SECRET
  else process.env.EBAY_CLIENT_SECRET = originalEbaySecret
})

const claim = {
  listingId: 'ebay-v1|123|0',
  year: '2020',
  make: 'Toyota',
  model: 'Camry',
  trim: 'SE',
  part: 'Brake Pads',
  source: 'eBay',
}

test('fitment proof validates only the exact signed vehicle, part, and listing', () => {
  const token = issueFitmentProof(claim, { now: 1_000, ttlMs: 10_000 })
  assert.equal(verifyFitmentProof(token, claim, { now: 5_000 }), true)
  assert.equal(verifyFitmentProof(token, { ...claim, model: 'Civic' }, { now: 5_000 }), false)
  assert.equal(verifyFitmentProof(token, { ...claim, listingId: 'ebay-other' }, { now: 5_000 }), false)
  assert.equal(verifyFitmentProof(token, { ...claim, part: 'Brake Rotors' }, { now: 5_000 }), false)
})

test('fitment proof rejects tampering and expiry', () => {
  const token = issueFitmentProof(claim, { now: 1_000, ttlMs: 1_000 })
  assert.equal(verifyFitmentProof(`${token}x`, claim, { now: 1_500 }), false)
  assert.equal(verifyFitmentProof(token, claim, { now: 2_000 }), false)
})

test('fitment proof is unavailable when no server secret can be derived', () => {
  delete process.env.FITMENT_PROOF_SECRET
  delete process.env.EBAY_CLIENT_SECRET
  assert.equal(issueFitmentProof(claim), null)
  assert.equal(verifyFitmentProof('anything', claim), false)
})
