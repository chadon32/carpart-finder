import { ApiError } from '../../api/client'
import {
  AccountDeletedLocalCleanupError,
  accountDeletionErrorMessage,
  ACCOUNT_DELETION_DATA_ITEMS,
  isAccountDeletionConfirmation,
} from '../accountDeletion'

test('cancel/empty confirmation cannot authorize deletion', () => {
  expect(isAccountDeletionConfirmation('')).toBe(false)
  expect(isAccountDeletionConfirmation('DELETE ')).toBe(false)
  expect(isAccountDeletionConfirmation('REMOVE')).toBe(false)
})

test('expired sessions get a reauthentication message', () => {
  expect(accountDeletionErrorMessage(new ApiError('expired', 401))).toMatch(/session expired/i)
})

test('network failures get a retry-safe message', () => {
  expect(accountDeletionErrorMessage(new TypeError('Network request failed'))).toMatch(/retrying is safe/i)
})

test('a completed deletion with local cleanup failure is not described as a server failure', () => {
  expect(accountDeletionErrorMessage(new AccountDeletedLocalCleanupError())).toMatch(
    /account was permanently deleted/i
  )
})

test('deletion disclosure describes CarPartsRadar data', () => {
  expect(ACCOUNT_DELETION_DATA_ITEMS).toEqual(
    expect.arrayContaining(['Saved searches', 'Price alerts', 'Garage vehicles', 'Watchlist'])
  )
  expect(ACCOUNT_DELETION_DATA_ITEMS.join(' ')).not.toMatch(/solar|calculation/i)
})
