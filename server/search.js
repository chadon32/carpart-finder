import * as ebay from './providers/ebay.js'
import * as aliexpress from './providers/aliexpress.js'

const providers = [
  { name: 'eBay', module: ebay },
  { name: 'AliExpress', module: aliexpress },
]

// Short-lived in-memory cache. Live prices don't change by the second, so
// caching identical searches for a few minutes makes back/forth navigation and
// repeat searches instant and avoids burning eBay API quota.
const CACHE_TTL_MS = 5 * 60 * 1000
// Stale-if-error window: when a live search fails outright, recent results
// (up to an hour old, clearly flagged as stale) beat an error page.
const STALE_TTL_MS = 60 * 60 * 1000
const cache = new Map()

export async function searchCheapestListings({ year, make, model, trim, part, zip, limit = 15 }) {
  const query = `${year} ${make} ${model}${trim ? ` ${trim}` : ''} ${part}`.trim()
  const ctx = { year, make, model, trim, part, zip, query }

  // Delivery estimates vary by ZIP, so the cache key must include it.
  const cacheKey = `${query}::${limit}::${zip || ''}`.toLowerCase()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.data, cached: true }
  }

  const active = providers.filter((p) => p.module.isConfigured())
  const skipped = providers.filter((p) => !p.module.isConfigured()).map((p) => p.name)

  // Fetch more than we need per provider so the merged, deduped list can still fill `limit`.
  const settled = await Promise.allSettled(active.map((p) => p.module.search(ctx, { limit: limit + 10 })))

  const providerErrors = {}
  let allResults = []

  settled.forEach((outcome, i) => {
    const name = active[i].name
    if (outcome.status === 'fulfilled') {
      allResults = allResults.concat(outcome.value)
    } else {
      providerErrors[name] = outcome.reason?.message || 'Unknown error'
    }
  })

  allResults.sort((a, b) => a.price - b.price)

  const seen = new Set()
  const results = []
  for (const item of allResults) {
    const key = `${item.source}:${item.seller}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(item)
    if (results.length >= limit) break
  }

  const data = { query, results, providerErrors, skippedProviders: skipped }

  // Every provider failed and we have nothing to show — fall back to the last
  // known-good results for this exact query if they're recent enough. A stale
  // price beats an error page, as long as the UI says it's stale.
  const totalFailure = results.length === 0 && Object.keys(providerErrors).length > 0
  if (totalFailure && cached && Date.now() < cached.staleUntil) {
    return { ...cached.data, stale: true, providerErrors }
  }

  // Only cache genuinely useful responses so a transient total failure isn't
  // frozen in for 5 minutes.
  if (results.length > 0) {
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS, staleUntil: Date.now() + STALE_TTL_MS })
  }

  return data
}
