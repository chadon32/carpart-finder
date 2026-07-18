const DEFAULT_TIMEOUT_MS = 20_000

// A second tap from the same user should not start a second destructive
// operation while the first one is still running. The database function is
// idempotent as a second line of defense for retries and serverless restarts.
const inFlightDeletions = new Map()

function withTimeout(promise, timeoutMs, operation) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${operation} timed out`)
      error.code = 'ACCOUNT_DELETION_TIMEOUT'
      reject(error)
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
export function isAlreadyDeletedAuthError(error) {
  const status = Number(error?.status ?? error?.statusCode)
  const code = String(error?.code ?? '').toLowerCase()
  const message = String(error?.message ?? '').toLowerCase()
  return status === 404 || code === 'user_not_found' || /user.*not found|not found.*user/.test(message)
}

export function deleteAccountPermanently({
  admin,
  userId,
  email,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!admin) throw new Error('Supabase admin client is unavailable')
  if (!userId) throw new Error('Authenticated user id is required')

  const existing = inFlightDeletions.get(userId)
  if (existing) return existing

  const operation = (async () => {
    let dataResult
    try {
      // This RPC is SECURITY DEFINER and is executable only by service_role.
      // It deletes all known user-owned rows in one database transaction.
      dataResult = await withTimeout(
        admin.rpc('delete_user_data', {
          p_user_id: userId,
          p_email: email || null,
        }),
        timeoutMs,
        'Account data deletion'
      )
    } catch (error) {
      return { success: false, stage: 'data', error }
    }

    if (dataResult?.error) {
      return { success: false, stage: 'data', error: dataResult.error }
    }

    let authResult
    try {
      // false is intentional: Apple requires permanent account deletion, not
      // Supabase's irreversible soft-delete mode.
      authResult = await withTimeout(
        admin.auth.admin.deleteUser(userId, false),
        timeoutMs,
        'Authentication account deletion'
      )
    } catch (error) {
      return { success: false, stage: 'auth', error }
    }

    if (authResult?.error && !isAlreadyDeletedAuthError(authResult.error)) {
      return { success: false, stage: 'auth', error: authResult.error }
    }

    return {
      success: true,
      alreadyDeleted: Boolean(authResult?.error),
    }
  })()

  inFlightDeletions.set(userId, operation)
  void operation.then(
    () => {
      if (inFlightDeletions.get(userId) === operation) inFlightDeletions.delete(userId)
    },
    () => {
      if (inFlightDeletions.get(userId) === operation) inFlightDeletions.delete(userId)
    }
  )
  return operation
}
