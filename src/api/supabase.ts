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

async function requestJson<T>(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
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

export function deleteAccount(): Promise<{ success: boolean; alreadyDeleted?: boolean }> {
  return requestJson(
    '/account',
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    },
    25_000
  )
}

// Clears the server-side auth cookie. Best-effort: a network failure here
// shouldn't block the client-side logout.
export async function logoutUser(): Promise<void> {
  try {
    await fetch(`${API_BASE}/logout`, { ...withCreds, method: 'POST' })
  } catch {
    /* ignore — client state is cleared regardless */
  }
}
