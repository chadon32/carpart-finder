export type AnalyticsBreakdown = { key: string; count: number }
export type WebsiteAnalytics = {
  version: 1
  days: number
  timezone: string
  startDate: string
  endDate: string
  firstTrackedAt: string | null
  totals: {
    dailyVisitors: number
    visits: number
    pageviews: number
    searches: number
    retailerClicks: number
    engagedVisits: number
    storeClickVisits: number
    emptySearches: number
    failedSearches: number
  }
  funnel: { rank: number; label: string; count: number }[]
  daily: {
    day: string
    visitors: number
    visits: number
    pageviews: number
    searches: number
    clicks: number
  }[]
  devices: AnalyticsBreakdown[]
  sources: AnalyticsBreakdown[]
  retailers: AnalyticsBreakdown[]
  pages: AnalyticsBreakdown[]
  actions: AnalyticsBreakdown[]
}

export class OwnerApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function ownerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)])
      : AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok)
    throw new OwnerApiError(
      typeof body?.error === 'string'
        ? body.error
        : 'Could not reach the owner dashboard. Please try again.',
      response.status,
    )
  if (!body || typeof body !== 'object')
    throw new OwnerApiError('The dashboard returned an invalid response.', 502)
  return body as T
}

export function analyticsPercent(count: number, total: number) {
  return total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '—'
}
