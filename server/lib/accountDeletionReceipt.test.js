import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ACCOUNT_DELETION_RECEIPT_TTL_MS,
  createAccountDeletionReceipt,
  verifyAccountDeletionReceipt,
} from './accountDeletionReceipt.js'

const env = {
  NODE_ENV: 'production',
  ACCOUNT_DELETION_RECEIPT_SECRET: 'a'.repeat(48),
}

test('issues a short-lived receipt bound to the authenticated user', () => {
  const receipt = createAccountDeletionReceipt('user-1', { env, now: 1_000, nonce: 'n'.repeat(22) })
  assert.ok(receipt)
  assert.deepEqual(
    verifyAccountDeletionReceipt(receipt, { env, now: 2_000, expectedUserId: 'user-1' }),
    { userId: 'user-1', expiresAt: 1_000 + ACCOUNT_DELETION_RECEIPT_TTL_MS }
  )
})

test('rejects tampering, expiry, and a receipt for another user', () => {
  const receipt = createAccountDeletionReceipt('user-1', { env, now: 1_000, nonce: 'n'.repeat(22) })
  assert.equal(verifyAccountDeletionReceipt(`${receipt}x`, { env, now: 2_000 }), null)
  assert.equal(verifyAccountDeletionReceipt(receipt, { env, now: 2_000, expectedUserId: 'user-2' }), null)
  assert.equal(
    verifyAccountDeletionReceipt(receipt, {
      env,
      now: 1_000 + ACCOUNT_DELETION_RECEIPT_TTL_MS,
    }),
    null
  )
})

test('fails closed in production when no signing secret is configured', () => {
  assert.equal(createAccountDeletionReceipt('user-1', { env: { NODE_ENV: 'production' } }), null)
})
