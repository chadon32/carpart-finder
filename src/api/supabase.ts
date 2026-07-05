const API_BASE = '/api/supabase'

function getAuthHeader(): Record<string, string> {
  const saved = localStorage.getItem('carpartsradar-user')
  if (!saved) return {}
  try {
    const user = JSON.parse(saved)
    const token = user.token || user.email || ''
    return { 'Authorization': `Bearer ${token}` }
  } catch {
    return {}
  }
}

export async function getCurrentUser() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: { ...getAuthHeader() }
  })
  if (!res.ok) throw new Error('Failed to fetch user')
  return res.json()
}

export async function getSavedSearches() {
  const res = await fetch(`${API_BASE}/saved-searches`, {
    headers: { ...getAuthHeader() }
  })
  if (!res.ok) throw new Error('Failed to fetch saved searches')
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
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(search)
  })
  if (!res.ok) throw new Error('Failed to save search')
  return res.json()
}

export async function deleteSavedSearch(id: string) {
  const res = await fetch(`${API_BASE}/saved-searches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  })
  if (!res.ok) throw new Error('Failed to delete saved search')
  return res.json()
}

export async function deletePriceAlert(id: string) {
  const res = await fetch(`${API_BASE}/price-alerts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  })
  if (!res.ok) throw new Error('Failed to delete price alert')
  return res.json()
}

export async function getPriceAlerts() {
  const res = await fetch(`${API_BASE}/price-alerts`, {
    headers: { ...getAuthHeader() }
  })
  if (!res.ok) throw new Error('Failed to fetch price alerts')
  return res.json()
}

export async function createPriceAlert(alert: {
  saved_search_id: string
  target_price: number
}) {
  const res = await fetch(`${API_BASE}/price-alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(alert)
  })
  if (!res.ok) throw new Error('Failed to create price alert')
  return res.json()
}

export async function signupUser(user: {
  email: string
  password?: string
  name?: string
}) {
  const res = await fetch(`${API_BASE}/signup`, {
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
}) {
  const res = await fetch(`${API_BASE}/login`, {
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