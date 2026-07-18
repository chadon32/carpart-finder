import { ApiError } from '../../api/client'
import {
  accountDeletionErrorMessage,
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
