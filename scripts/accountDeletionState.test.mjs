import test from 'node:test'
import assert from 'node:assert/strict'
import {
  accountDeletionErrorMessage,
  accountDeletionRequiresReauthentication,
  canStartAccountDeletion,
  isRequiredAccountDeletionEmail,
} from '../src/lib/accountDeletionState.js'

test('cancelled or incomplete confirmation cannot start deletion', () => {
  assert.equal(canStartAccountDeletion({ confirmation: '', deleting: false, started: false }), false)
  assert.equal(canStartAccountDeletion({ confirmation: 'delete', deleting: false, started: false }), false)
})

test('multiple rapid submissions are blocked once deletion starts', () => {
  assert.equal(canStartAccountDeletion({ confirmation: 'DELETE', deleting: false, started: false }), true)
  assert.equal(canStartAccountDeletion({ confirmation: 'DELETE', deleting: true, started: true }), false)
})

test('expired sessions and network failures receive actionable messages', () => {
  assert.equal(accountDeletionRequiresReauthentication({ status: 401 }), true)
  assert.equal(accountDeletionRequiresReauthentication({ status: 403 }), true)
  assert.equal(accountDeletionRequiresReauthentication({ status: 500 }), false)
  assert.match(accountDeletionErrorMessage({ status: 401 }), /session has expired/i)
  assert.match(accountDeletionErrorMessage({ status: 0 }), /check your connection/i)
  assert.match(accountDeletionErrorMessage({ status: 408, message: 'The account request timed out.' }), /check your connection/i)
  assert.match(accountDeletionErrorMessage({ message: 'Failed to fetch' }), /check your connection/i)
  assert.match(accountDeletionErrorMessage({ status: 504, message: 'Gateway timeout' }), /check your connection/i)
})

test('deletion reauthentication accepts only the original account email', () => {
  assert.equal(isRequiredAccountDeletionEmail('Driver@Example.com', 'driver@example.com'), true)
  assert.equal(isRequiredAccountDeletionEmail(' other@example.com ', 'driver@example.com'), false)
  assert.equal(isRequiredAccountDeletionEmail('any@example.com', null), true)
})
