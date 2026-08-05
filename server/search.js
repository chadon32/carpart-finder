import * as ebay from './providers/ebay.js'
import * as aliexpress from './providers/aliexpress.js'
import { issueFitmentProof } from './lib/fitmentProof.js'
import { partitionListingsByFitment } from './lib/fitmentPolicy.js'
import { filterListingsByPartIntent } from './lib/listingRelevance.js'
import { affiliateContextForChannel } from './lib/affiliatePolicy.js'

const providers = [
  { name: 'eBay', module: ebay },
  { name: 'AliExpress', module: aliexpress },
]

// ==================== CACHE CONFIGURATION ====================
// Short-lived in-memory cache. Live prices don't change by the second, so
// caching identical searches for a few minutes makes back/forth navigation and
// repeat searches instant and avoids burning eBay API quota.
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 5 * 60 * 1000          // 5 minutes default
const STALE_TTL_MS = Number(process.env.STALE_TTL_MS) || 60 * 60 * 1000        // 1 hour stale fallback
const MAX_CACHE_SIZE = Number(process.env.MAX_CACHE_SIZE) || 500               // Max cached searches

const cache = new Map()
const pendingSearches = new Map()

// Simple LRU eviction: delete oldest entries when over limit
function evictOldestIfNeeded() {
  if (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    cache.delete(oldestKey)
  }
}


// ==================== MAIN SEARCH FUNCTION ====================
export async function searchCheapestListings({
  year,
  make,
  model,
  trim,
  part,
  zip,
  channel = 'web',
  limit = 15,
  sort = 'price',
}) {
  const query = `${year} ${make} ${model}${trim ? ` ${trim}` : ''} ${part}`.trim()
  const affiliate = affiliateContextForChannel(channel, {
    campaignId: process.env.EBAY_EPN_CAMPAIGN_ID,
    mobileApproved: process.env.EBAY_EPN_MOBILE_APPROVED === '1',
  })
  const ctx = { year, make, model, trim, part, zip, query, affiliate }

  // Delivery estimates vary by ZIP and the result set varies by sort, so the
  // cache key must include both.
  const cacheKey = `${query}::${limit}::${zip || ''}::${sort}::${affiliate?.referenceId || 'nonaffiliate'}`.toLowerCase()
  const cached = cache.get(cacheKey)

  if (cached && Date.now() < cached.expiresAt) {
    return { ...cached.data, cached: true }
  }

  if (pendingSearches.has(cacheKey)) {
    return pendingSearches.get(cacheKey)
  }

  const promise = (async () => {
    try {
      const active = providers.filter((p) => p.module.isConfigured())
      const skipped = providers.filter((p) => !p.module.isConfigured()).map((p) => p.name)

      // No providers configured: return an honest empty result. The UI's
      // error/empty states handle this — never show fabricated listings.
      if (active.length === 0) {
        return {
          query,
          results: [],
          fallbackResults: [],
          fitmentSummary: { verified: 0, fallback: 0, hiddenIrrelevantFallbacks: 0 },
          providerErrors: { config: 'No search providers are configured (missing API keys)' },
          skippedProviders: skipped,
        }
      }

      // Fetch more than we need per provider so the merged, deduped list can still fill `limit`.
      const settled = await Promise.allSettled(active.map((p) => p.module.search(ctx, { limit: limit + 10, sort })))

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


      // Keep a larger fallback reservoir before applying part-intent checks.
      // That lets us remove obvious accessory-only keyword results while still
      // filling the clearly labeled fallback section when useful inventory is
      // available. Verified provider matches are intentionally untouched.
      const { verified, fallback } = partitionListingsByFitment(allResults, limit * 3)
      const results = verified.slice(0, limit).map((item) => ({
        ...item,
        fitmentProof: issueFitmentProof({
          listingId: item.id,
          year,
          make,
          model,
          trim: trim || '',
          part,
          source: item.source,
        }),
      }))
      const relevantFallbacks = filterListingsByPartIntent(fallback, part)
      const fallbackResults = relevantFallbacks
        .slice(0, limit)
        .map((item) => ({ ...item, fitmentProof: null }))
      const hiddenIrrelevantFallbacks = fallback.length - relevantFallbacks.length

      const data = {
        query,
        results,
        fallbackResults,
        fitmentSummary: { verified: results.length, fallback: fallbackResults.length, hiddenIrrelevantFallbacks },
        providerErrors,
        skippedProviders: skipped,
      }

      // Every provider failed and we have nothing to show — fall back to the last
      // known-good results for this exact query if they're recent enough. A stale
      // price beats an error page, as long as the UI says it's stale.
      const totalFailure =
        results.length === 0 &&
        fallbackResults.length === 0 &&
        Object.keys(providerErrors).length > 0
      if (totalFailure && cached && Date.now() < cached.staleUntil) {
        return {
          ...cached.data,
          results: cached.data.results.map((item) => ({ ...item, fitmentProof: null })),
          stale: true,
          providerErrors,
        }
      }

      // Only cache genuinely useful responses so a transient total failure isn't
      // frozen in for 5 minutes.
      if (results.length > 0 || fallbackResults.length > 0) {
        evictOldestIfNeeded()
        cache.set(cacheKey, {
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
          staleUntil: Date.now() + STALE_TTL_MS,
        })
      }

      return data
    } finally {
      pendingSearches.delete(cacheKey)
    }
  })()

  pendingSearches.set(cacheKey, promise)
  return promise
}
