import { fetchWithRetry } from './httpClient.js'

// NHTSA's recalls API (separate from vPIC): free, keyless, authoritative.
// Recall campaigns change rarely, so a day of caching is safe and keeps a
// popular garage vehicle from re-hitting NHTSA on every visit.
const RECALLS_URL = 'https://api.nhtsa.gov/recalls/recallsByVehicle'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_CACHE = 500

const cache = new Map()
const pending = new Map()

export async function getRecalls(make, model, year) {
  const key = `${year}::${make}::${model}`.toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  if (pending.has(key)) {
    return pending.get(key)
  }

  const promise = (async () => {
    try {
      const params = new URLSearchParams({ make, model, modelYear: year })
      const res = await fetchWithRetry(`${RECALLS_URL}?${params.toString()}`, {}, { timeoutMs: 10000, retries: 2 })
      if (!res.ok) throw new Error(`NHTSA recalls lookup failed (${res.status})`)
      const data = await res.json()
      if (!data || !Array.isArray(data.results)) {
        // Missing or malformed upstream data is not an empty recall lookup.
        // Do not cache it as a successful result for the rest of the day.
        throw new Error('NHTSA returned an unreadable recall response')
      }
      const clean = (v) => {
        if (v != null && typeof v !== 'string') throw new Error('NHTSA returned an unreadable recall field')
        const s = v == null ? '' : v.trim()
        return s || null
      }
      const recalls = data.results.map((r) => {
        if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Error('NHTSA returned an unreadable recall record')
        return {
          campaignNumber: clean(r.NHTSACampaignNumber),
          component: clean(r.Component),
          summary: clean(r.Summary),
          consequence: clean(r.Consequence),
          remedy: clean(r.Remedy),
          reportedDate: clean(r.ReportReceivedDate),
        }
      })
      if (cache.size >= MAX_CACHE) {
        cache.delete(cache.keys().next().value)
      }
      cache.set(key, { data: recalls, expiresAt: Date.now() + CACHE_TTL_MS })
      return recalls
    } finally {
      pending.delete(key)
    }
  })()

  pending.set(key, promise)
  return promise
}
