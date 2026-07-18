import { ApiError } from '../api/client'

export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE'

export function isAccountDeletionConfirmation(value: string) {
  return value === ACCOUNT_DELETION_CONFIRMATION
}

export function accountDeletionErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Your session expired. Cancel, log in again from the Garage tab, and then reopen Account settings.'
  }
  if (error instanceof ApiError && error.status === 400) {
    return error.message
  }
  if (error instanceof ApiError && error.status === 502) {
    return 'Your data was removed, but account closure could not be completed. Check your connection and try again.'
  }
  if (error instanceof TypeError || (error instanceof Error && /network|fetch|timeout/i.test(error.message))) {
    return 'We could not confirm the deletion with the server. Check your connection and try again; retrying is safe.'
  }
  return 'We could not delete your account. Please try again.'
}
