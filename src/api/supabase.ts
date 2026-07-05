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

export async function getCurrentUser() {
  const res = await fetch(`${API_BASE}/me`, { ...withCreds })
  if (!res.ok) throw new ApiError('Failed to fetch user', res.status)
  return res.json()
}

export async function getSavedSearches() {
  const res = await fetch(`${API_BASE}/saved-searches`, { ...withCreds })
  if (!res.ok) throw new ApiError('Failed to fetch saved searches', res.status)
  return res.json()
}

export async function saveSearch(search: {
  year: string
  make: string
  model: string
  trim?: string
  part: string
}) {
  const res = await fetch(`${API_BASE}/saved-searches`, {
    ...withCreds,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(search)
  })
  if (!res.ok) throw new ApiError('Failed to save search', res.status)
  return res.json()
}

export async function deleteSavedSearch(id: string) {
  const res = await fetch(`${API_BASE}/saved-searches/${encodeURIComponent(id)}`, {
    ...withCreds,
    method: 'DELETE'
  })
  if (!res.ok) throw new ApiError('Failed to delete saved search', res.status)
  return res.json()
}

export async function deletePriceAlert(id: string) {
  const res = await fetch(`${API_BASE}/price-alerts/${encodeURIComponent(id)}`, {
    ...withCreds,
    method: 'DELETE'
  })
  if (!res.ok) throw new ApiError('Failed to delete price alert', res.status)
  return res.json()
}

export async function getPriceAlerts() {
  const res = await fetch(`${API_BASE}/price-alerts`, { ...withCreds })
  if (!res.ok) throw new ApiError('Failed to fetch price alerts', res.status)
  return res.json()
}

export async function createPriceAlert(alert: {
  saved_search_id: string
  target_price: number
}) {
  const res = await fetch(`${API_BASE}/price-alerts`, {
    ...withCreds,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert)
  })
  if (!res.ok) throw new ApiError('Failed to create price alert', res.status)
  return res.json()
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
  const res = await fetch(`${API_BASE}/signup`, {
    ...withCreds,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to sign up')
  }
  return res.json()
}

export async function loginUser(credentials: {
  email: string
  password?: string
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/login`, {
    ...withCreds,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to log in')
  }
  return res.json()
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
