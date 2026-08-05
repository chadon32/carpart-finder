export function canStartAccountDeletion({ confirmation, deleting, started }) {
  return confirmation === 'DELETE' && !deleting && !started
}

export function accountDeletionRequiresReauthentication(error) {
  return [401, 403].includes(Number(error?.status || 0))
}

export function isRequiredAccountDeletionEmail(email, requiredEmail) {
  if (!requiredEmail) return true
  return String(email || '').trim().toLowerCase() === String(requiredEmail).trim().toLowerCase()
}

export function accountDeletionErrorMessage(error) {
  const status = Number(error?.status || 0)
  if (accountDeletionRequiresReauthentication(error)) {
    return 'Your session has expired. Sign in again before deleting your account.'
  }
  if (status === 0 || status === 408 || status === 504 || /timeout|network|fetch/i.test(String(error?.message || ''))) {
    return 'We could not reach the account service. Check your connection and try again.'
  }
  return error?.message || 'We could not delete your account. Please try again.'
}
