import { ApiError } from '../api/client'

export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE'
export const ACCOUNT_DELETION_DATA_ITEMS = [
  'Profile',
  'Saved searches',
  'Price alerts',
  'Garage vehicles',
  'Watchlist',
  'Preferences and any other user-generated data',
] as const

export class AccountDeletedLocalCleanupError extends Error {
  constructor() {
    super('Your account was permanently deleted, but this device could not clear all cached data.')
    this.name = 'AccountDeletedLocalCleanupError'
  }
}

export function isAccountDeletedLocalCleanupError(error: unknown) {
  return error instanceof AccountDeletedLocalCleanupError
}

export function isAccountDeletionConfirmation(value: string) {
  return value === ACCOUNT_DELETION_CONFIRMATION
}

export function accountDeletionErrorMessage(error: unknown) {
  if (isAccountDeletedLocalCleanupError(error)) {
    return error.message
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'Your session expired. Sign in again before retrying account deletion.'
  }
  if (error instanceof ApiError && error.status === 400) {
    return error.message
  }
  if (error instanceof ApiError && error.status === 502) {
    return 'Your data was removed, but final account closure did not complete. Please retry; retrying is safe.'
  }
  if (error instanceof TypeError || (error instanceof Error && /network|fetch|timeout/i.test(error.message))) {
    return 'We could not confirm the deletion with the server. Check your connection and try again; retrying is safe.'
  }
  return 'We could not delete your account. Please try again.'
}
