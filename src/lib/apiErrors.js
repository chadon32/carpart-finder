function resourceLabel(url) {
  if (url.includes('/search') || url.includes('/prices') || url.includes('/price-history') || url.includes('/quote')) return 'prices'
  if (url.includes('/makes') || url.includes('/models') || url.includes('/trims') || url.includes('/vin') || url.includes('/vehicle-image')) {
    return 'vehicle data'
  }
  if (url.includes('/diagnose') || url.includes('/identify-part') || url.includes('/repair-guide')) return 'repair guidance'
  if (url.includes('/auth') || url.includes('/supabase')) return 'account data'
  return 'data'
}

export class FriendlyApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'FriendlyApiError'
    this.status = status
  }
}

export function friendlyApiError(url, status = 0, { parseFailed = false } = {}) {
  const label = resourceLabel(url)
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again and retry.'
  if (status === 429) return 'Too many requests right now. Please wait a moment and try again.'
  if (parseFailed || status >= 500 || status === 0) {
    return `We couldn't load ${label} right now. Check your connection and try again.`
  }
  return `We couldn't load ${label}. Check the details and try again.`
}

export async function readJsonResponse(res, url) {
  let data
  try {
    data = await res.json()
  } catch {
    throw new FriendlyApiError(friendlyApiError(url, res.status, { parseFailed: true }), res.status)
  }
  if (!res.ok) {
    const serverError = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : null
    if (serverError === 'Origin not allowed') {
      throw new FriendlyApiError(
        "This request isn't allowed from the current app address. Reload the official site and try again.",
        res.status
      )
    }
    throw new FriendlyApiError(serverError || friendlyApiError(url, res.status), res.status)
  }
  return data
}
