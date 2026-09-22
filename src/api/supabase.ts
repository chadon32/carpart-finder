import { FriendlyApiError, friendlyApiError, readJsonResponse } from '../lib/apiErrors.js'

const API_BASE = '/api/supabase'

// Error that preserves the HTTP status so callers can tell an auth failure
// (401 — "log in") apart from a server/network problem ("try again").
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Auth is carried by an httpOnly cookie the server sets on login/signup, so
// every request that needs it just has to opt into sending cookies. The token
// is never exposed to JS, so there's no Authorization header to build here.
const withCreds: RequestInit = { credentials: 'include' }
const PENDING_ACCOUNT_DELETION_RECEIPT_KEY = 'cpf-pending-account-deletion'
let pendingAccountDeletionReceipt: string | null = null

function readPendingDeletionReceipt() {
  if (pendingAccountDeletionReceipt) return pendingAccountDeletionReceipt
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      const receipt = storage?.getItem(PENDING_ACCOUNT_DELETION_RECEIPT_KEY)
      if (receipt) {
        pendingAccountDeletionReceipt = receipt
        return receipt
      }
    } catch {
      // Try the other browser storage surface.
    }
  }
  return null
}

function persistPendingDeletionReceipt(receipt: string) {
  pendingAccountDeletionReceipt = receipt
  let persisted = false
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      storage?.setItem(PENDING_ACCOUNT_DELETION_RECEIPT_KEY, receipt)
      persisted = Boolean(storage) || persisted
    } catch {
      // One storage surface can be blocked while the other remains usable.
    }
  }
  return persisted
}

function clearPendingDeletionReceipt() {
  pendingAccountDeletionReceipt = null
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      storage?.removeItem(PENDING_ACCOUNT_DELETION_RECEIPT_KEY)
    } catch {
      // Best effort; clearLocalUserData performs another prefix-based pass.
    }
  }
}

type SavedSearch = {
  id: string
  year: string
  make: string
  model: string
  trim?: string | null
  part: string
}

type PriceAlert = {
  id: string
  saved_search_id: string
  target_price: number
  triggered_at?: string | null
  last_price?: number | null
  saved_searches?: Pick<SavedSearch, 'year' | 'make' | 'model' | 'part'> | null
}

async function requestJson<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const url = `${API_BASE}${path}`
  const controller = timeoutMs && !init.signal ? new AbortController() : null
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null

  try {
    let res: Response
    try {
      res = await fetch(url, {
        ...withCreds,
        ...init,
        ...(controller ? { signal: controller.signal } : {}),
      })
    } catch {
      if (controller?.signal.aborted) {
        throw new ApiError('The account request timed out.', 408)
      }
      throw new ApiError(friendlyApiError(url, 0), 0)
    }
    try {
      return await readJsonResponse<T>(res, url)
    } catch (error) {
      if (controller?.signal.aborted) {
        throw new ApiError('The account request timed out.', 408)
      }
      const status = error instanceof FriendlyApiError ? error.status : res.status
      const message = error instanceof Error ? error.message : friendlyApiError(url, status)
      throw new ApiError(message, status)
    }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function getCurrentUser() {
  return requestJson('/me')
}

export async function getSavedSearches(): Promise<{ searches: SavedSearch[] }> {
  return requestJson('/saved-searches')
}

export async function saveSearch(search: {
  year: string
  make: string
  model: string
  trim?: string
  part: string
}) {
  return requestJson('/saved-searches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(search)
  })
}

export async function deleteSavedSearch(id: string) {
  return requestJson(`/saved-searches/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}

export async function deletePriceAlert(id: string) {
  return requestJson(`/price-alerts/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}

export async function getPriceAlerts(): Promise<{ alerts: PriceAlert[] }> {
  return requestJson('/price-alerts')
}

export async function createPriceAlert(alert: {
  saved_search_id: string
  target_price: number
}) {
  return requestJson('/price-alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert)
  })
}

type AuthResponse = {
  user?: { email?: string; user_metadata?: { full_name?: string } }
  confirmationRequired?: boolean
}

export async function signupUser(user: {
  email: string
  password?: string
  name?: string
}): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  })
}

export async function loginUser(credentials: {
  email: string
  password?: string
}): Promise<AuthResponse> {
  return requestJson<AuthResponse>('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
}

type AccountDeletionStatus = { success: boolean; deleted: boolean }

async function checkDeletionReceipt(receipt: string): Promise<AccountDeletionStatus> {
  return requestJson('/account/deletion-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receipt }),
  }, 10_000)
}

export async function reconcilePendingAccountDeletion(): Promise<boolean> {
  const receipt = readPendingDeletionReceipt()
  if (!receipt) return false
  try {
    const status = await checkDeletionReceipt(receipt)
    if (status.deleted) clearPendingDeletionReceipt()
    return status.deleted
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) clearPendingDeletionReceipt()
    return false
  }
}

export async function deleteAccount(): Promise<{ success: boolean; alreadyDeleted?: boolean }> {
  let receipt = readPendingDeletionReceipt()
  if (receipt && await reconcilePendingAccountDeletion()) {
    return { success: true, alreadyDeleted: true }
  }
  receipt = readPendingDeletionReceipt()

  if (!receipt) {
    const intent = await requestJson<{ receipt: string }>('/account/deletion-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    })
    receipt = intent.receipt
    if (!receipt || !persistPendingDeletionReceipt(receipt)) {
      throw new ApiError('This browser could not safely prepare account deletion. Enable local storage and try again.', 0)
    }
  }

  try {
    const result = await requestJson<{ success: boolean; alreadyDeleted?: boolean }>(
      '/account',
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE', receipt }),
      },
      25_000
    )
    clearPendingDeletionReceipt()
    return result
  } catch (error) {
    // A timeout or lost response is not proof of failure. The receipt was
    // issued before deletion began, so it can safely reconcile the now-invalid
    // Auth session without exposing a user-id deletion parameter.
    if (await reconcilePendingAccountDeletion()) {
      return { success: true, alreadyDeleted: true }
    }
    throw error
  }
}

// Clear the server-side auth cookie with a bounded request. Callers decide how
// to present a local-only sign-out if the network cannot confirm completion.
export async function logoutUser(): Promise<void> {
  await requestJson('/logout', { method: 'POST' }, 10_000)
}
