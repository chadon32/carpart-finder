import { EBAY_API_ROOT, getAccessToken, isConfigured } from '../ebayAuth.js'
import { categoryForPart } from '../partCategories.js'
import { fetchWithRetry } from '../httpClient.js'
import { mapWithConcurrency } from '../lib/concurrency.js'
import { listingDoesNotContradictVehicle } from '../lib/fitmentPolicy.js'

const SEARCH_URL = `${EBAY_API_ROOT}/buy/browse/v1/item_summary/search`
const ITEM_URL = `${EBAY_API_ROOT}/buy/browse/v1/item`

export { isConfigured }

// Fetches the current price + availability for specific eBay item ids so the
// cart can detect price drops or sold-out items since they were saved.
// ids are the app's prefixed ids ("ebay-v1|123|0"); the eBay itemId is the rest.
export async function getCurrentPrices(ids) {
  const token = await getAccessToken()

  // Bounded: `ids` is user-supplied. An unbounded Promise.all here turned a
  // single GET /api/prices into one outbound eBay call per id, with no ceiling.
  const entries = await mapWithConcurrency(ids, 5, async (id) => {
    const itemId = id.startsWith('ebay-') ? id.slice('ebay-'.length) : id
    try {
      const res = await fetchWithRetry(
        `${ITEM_URL}/${encodeURIComponent(itemId)}`,
        { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } },
        { timeoutMs: 6000, retries: 1 }
      )
      if (res.status === 404) {
        return [id, { available: false }]
      }
      if (!res.ok) return [id, null]
      const data = await res.json()
      const status = data.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus
      return [
        id,
        {
          available: status !== 'OUT_OF_STOCK',
          price: data.price?.value != null ? Number(data.price.value) : null,
        },
      ]
    } catch {
      return [id, null]
    }
  })

  const map = {}
  for (const [id, value] of entries) {
    if (value) map[id] = value
  }
  return map
}

const BASE_FILTER =
  'buyingOptions:{FIXED_PRICE},itemLocationCountry:US,deliveryCountry:US,conditionIds:{1000|1500|2000|2500|3000}'

// X-EBAY-C-ENDUSERCTX carries comma-separated context params. affiliateCampaignId
// is the EPN (eBay Partner Network) campaign — when present, eBay returns
// itemAffiliateWebUrl and clicks become commissionable. contextualLocation makes
// shipping costs/dates accurate for the buyer's ZIP. Exported for tests.
export function buildEndUserCtx({ zip, campaignId, referenceId } = {}) {
  const parts = []
  if (campaignId) parts.push(`affiliateCampaignId=${campaignId}`)
  if (campaignId && referenceId) parts.push(`affiliateReferenceId=${encodeURIComponent(referenceId)}`)
  if (zip) parts.push(`contextualLocation=${encodeURIComponent(`country=US,zip=${zip}`)}`)
  return parts.length > 0 ? parts.join(',') : undefined
}

async function runSearch(token, { q, categoryId, compatibilityFilter, zip, affiliate, sort = 'price' }) {
  const params = new URLSearchParams({
    q,
    limit: '50',
    fieldgroups: 'EXTENDED',
    filter: BASE_FILTER,
  })
  // Omitting the sort param gives eBay's Best Match relevance ranking, which
  // buries the cheap accessory spam (screw kits, covers) that dominates a
  // price-ascending page. Quotes use this; the browse UI keeps price sort.
  if (sort !== 'relevance') params.set('sort', 'price')
  if (categoryId) params.set('category_ids', categoryId)
  if (compatibilityFilter) params.set('compatibility_filter', compatibilityFilter)

  const headers = {
    Authorization: `Bearer ${token}`,
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
  }
  // EPN campaign id is read at call time so a config change doesn't require
  // a code change, and tests can exercise the pure builder directly.
  const endUserCtx = buildEndUserCtx({
    zip,
    campaignId: affiliate?.campaignId,
    referenceId: affiliate?.referenceId,
  })
  if (endUserCtx) {
    headers['X-EBAY-C-ENDUSERCTX'] = endUserCtx
  }

  // Tight timeout + one retry: the search runs up to three relaxation tiers,
  // so generous per-call budgets would compound into a very slow worst case.
  const res = await fetchWithRetry(`${SEARCH_URL}?${params.toString()}`, { headers }, { timeoutMs: 7000, retries: 1 })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`eBay search failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.itemSummaries || []
}

// A listing has to be actually buyable to be worth showing: real title, a
// working link, and a plausible price. eBay occasionally returns $0 stubs.
function isValidItem(item) {
  return Boolean(item.title && item.itemWebUrl && Number(item.price?.value) > 0)
}

// Browse search can return items that are only POSSIBLE matches, or items with
// no compatibilityProperties at all, even when compatibility_filter is used.
// Only an explicit EXACT result is safe to present as verified. This must be
// derived from eBay's response rather than from the fact that we sent a filter.
export function isExactCompatibility(item) {
  return item.compatibilityMatch === 'EXACT'
}

export function filterExactCompatibility(items) {
  return items.filter(isExactCompatibility)
}

export function marketplaceSearchKeyword(ctx) {
  return String(ctx?.part || '').trim() || String(ctx?.query || '').trim()
}

export function buildSearchAttempts(ctx, { categoryId, compatibilityFilter, zip, sort }) {
  const q = marketplaceSearchKeyword(ctx)
  return [
    // Fetch compatibility matches by marketplace relevance so cheap clips,
    // hardware, and damaged inventory do not crowd exact matches out of the
    // first provider page. The server still ranks accepted results by total.
    { q, categoryId, compatibilityFilter, zip, sort: 'relevance' },
    { q, categoryId, zip, sort },
    { q: ctx.query, categoryId: undefined, compatibilityFilter: undefined, zip, sort },
  ]
}

export function mapItem(item, { compatibilityFilterUsed = false, vehicle = null } = {}) {
  const exactProviderMatch = compatibilityFilterUsed && isExactCompatibility(item)
  const titleConsistent = listingDoesNotContradictVehicle(item, vehicle)
  const verifiedFitment = exactProviderMatch && titleConsistent
  return {
    id: `ebay-${item.itemId}`,
    verifiedFitment,
    fitmentTier: verifiedFitment ? 'verified' : 'fallback',
    fitmentEvidence: {
      provider: 'eBay',
      matchType: verifiedFitment ? 'EXACT' : null,
      scope: 'year-make-model',
      matchedVehicle: vehicle
        ? {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
          }
        : null,
      checkedAt: new Date().toISOString(),
      note: verifiedFitment
        ? 'The marketplace returned an exact year, make, and model compatibility match. Trim, engine, drivetrain, and option-level fitment may still require confirmation.'
        : exactProviderMatch && !titleConsistent
          ? 'The marketplace compatibility response conflicted with the vehicle or model years stated in the listing, so CarPartsRadar did not treat it as a match.'
          : 'This is a broad marketplace result. Compatibility was not confirmed.',
    },
    title: item.title,
    price: Number(item.price?.value ?? 0),
    currency: item.price?.currency ?? 'USD',
    condition: item.condition ?? 'Not specified',
    seller: item.seller?.username || 'Unknown seller',
    sellerFeedbackPercentage: item.seller?.feedbackPercentage ?? null,
    sellerFeedbackScore: item.seller?.feedbackScore ?? null,
    image: item.image?.imageUrl ?? null,
    link: item.itemAffiliateWebUrl || item.itemWebUrl,
    source: 'eBay',
    crossBorder: false,
    originalPrice: item.marketingPrice?.originalPrice?.value
      ? Number(item.marketingPrice.originalPrice.value)
      : null,
    discountPercentage: item.marketingPrice?.discountPercentage ?? null,
    itemLocation: [item.itemLocation?.city, item.itemLocation?.country].filter(Boolean).join(', ') || null,
    topRatedSeller: Boolean(item.topRatedBuyingExperience),
    bestOfferAccepted: (item.buyingOptions || []).includes('BEST_OFFER'),
    shortDescription: item.shortDescription ?? null,
    shippingCost: item.shippingOptions?.[0]?.shippingCost?.value != null
      ? Number(item.shippingOptions[0].shippingCost.value)
      : null,
    deliveryMin: item.shippingOptions?.[0]?.minEstimatedDeliveryDate ?? null,
    deliveryMax: item.shippingOptions?.[0]?.maxEstimatedDeliveryDate ?? null,
  }
}

export function filterVehicleContradictions(items, vehicle) {
  return items.filter((item) => listingDoesNotContradictVehicle(item, vehicle))
}

// ctx: { year, make, model, trim, part, query }
export async function search(ctx, { limit = 10, sort = 'price' } = {}) {
  const token = await getAccessToken()

  const categoryId = ctx.part ? categoryForPart(ctx.part) : undefined
  const compatibilityFilter =
    ctx.year && ctx.make && ctx.model ? `Year:${ctx.year};Make:${ctx.make};Model:${ctx.model}` : undefined
  // The category constrains the part type and the compatibility filter
  // constrains the vehicle. A verbose trim label such as "LE Sedan 4-Door"
  // over-narrows eBay's keyword search, so keep the keyword to the part name.

  // Progressively relax: fitment-filtered → category keyword → plain keyword.
  // Each tier trades precision for recall so we still return something useful
  // for vehicles/parts eBay has thin fitment data on.
  const zip = ctx.zip
  const attempts = buildSearchAttempts(ctx, { categoryId, compatibilityFilter, zip, sort })
  const vehicle = {
    year: ctx.year,
    make: ctx.make,
    model: ctx.model,
    ...(ctx.trim ? { trim: ctx.trim } : {}),
  }

  let items = []
  let compatibilityFilterUsed = false
  for (const attempt of attempts) {
    const rawItems = (await runSearch(token, { ...attempt, affiliate: ctx.affiliate })).filter(isValidItem)
    // eBay documents that compatibility-filtered searches can include
    // POSSIBLE and non-matching items. Exclude those from the filtered tier;
    // if no EXACT result exists, the next tier is intentionally unverified.
    const compatibleItems = attempt.compatibilityFilter ? filterExactCompatibility(rawItems) : rawItems
    // Unknown fitment can remain in a clearly labeled fallback group, but an
    // explicit wrong make, model, or year is never useful. Filter before
    // deciding an attempt succeeded so a contradictory tier cannot prevent a
    // later, more useful fallback attempt from running.
    items = filterVehicleContradictions(compatibleItems, vehicle)
    if (items.length > 0) {
      compatibilityFilterUsed = Boolean(attempt.compatibilityFilter)
      break
    }
  }

  const seenSellers = new Set()
  const seenItemIds = new Set()
  const results = []
  for (const item of items) {
    const seller = item.seller?.username || 'Unknown seller'
    if (seenSellers.has(seller) || seenItemIds.has(item.itemId)) continue
    seenSellers.add(seller)
    seenItemIds.add(item.itemId)
    results.push(mapItem(item, {
      compatibilityFilterUsed,
      vehicle,
    }))
    if (results.length >= limit) break
  }

  return results
}
