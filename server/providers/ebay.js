import { EBAY_API_ROOT, getAccessToken, isConfigured } from '../ebayAuth.js'
import { categoryForPart } from '../partCategories.js'
import { fetchWithRetry } from '../httpClient.js'
import { mapWithConcurrency } from '../lib/concurrency.js'
import { listingDoesNotContradictVehicle } from '../lib/fitmentPolicy.js'
import { safeRetailerUrl } from '../../shared/outboundUrl.js'
import { normalizeMake } from '../../shared/vehicleMake.js'
import { getEbayModels } from '../ebayCompatibility.js'
import { matchEbayModels } from '../lib/ebayModelMatch.js'
import { isLikelyPartNumberQuery, mentionsPartNumber, partNumberQueryVariants } from '../lib/partNumber.js'

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
export function itemDestination(item) {
  return safeRetailerUrl(item.itemAffiliateWebUrl) || safeRetailerUrl(item.itemWebUrl)
}

function isValidItem(item) {
  return Boolean(
    item.title
    && itemDestination(item)
    && Number(item.price?.value) > 0
  )
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

// compatibilityTargets lists every eBay spelling of the selected model
// ({ filter, model }). The single compatibilityFilter is the first of them.
export function buildSearchAttempts(ctx, { categoryId, compatibilityFilter, compatibilityTargets, zip, sort }) {
  const q = marketplaceSearchKeyword(ctx)
  const targets = compatibilityTargets?.length
    ? compatibilityTargets
    : compatibilityFilter ? [{ filter: compatibilityFilter, model: ctx.model }] : []

  if (isLikelyPartNumberQuery(ctx.part)) {
    // A part number identifies one item, so the vehicle words in the fallback
    // query only get in the way. Ask for the number as typed, then with its
    // separators as spaces.
    return [
      { q, categoryId, compatibilityFilter: targets[0]?.filter, compatibilityTargets: targets, zip, sort: 'relevance' },
      ...partNumberQueryVariants(ctx.part).map((variant) => ({ q: variant, categoryId: undefined, zip, sort, partNumberKeyword: true })),
    ]
  }

  return [
    // Fetch compatibility matches by marketplace relevance so cheap clips,
    // hardware, and damaged inventory do not crowd exact matches out of the
    // first provider page. The server still ranks accepted results by total.
    { q, categoryId, compatibilityFilter, compatibilityTargets: targets, zip, sort: 'relevance' },
    { q, categoryId, zip, sort },
    { q: ctx.query, categoryId: undefined, compatibilityFilter: undefined, zip, sort },
  ]
}

export function mapItem(item, { compatibilityFilterUsed = false, vehicle = null, partNumberQuery = null } = {}) {
  const exactProviderMatch = compatibilityFilterUsed && isExactCompatibility(item)
  const titleConsistent = listingDoesNotContradictVehicle(item, vehicle)
  const verifiedFitment = exactProviderMatch && titleConsistent
  // For a part-number search, say whether the listing itself states the number.
  const partNumberMatch = partNumberQuery ? (mentionsPartNumber(item, partNumberQuery) ? 'exact' : 'related') : null
  return {
    id: `ebay-${item.itemId}`,
    verifiedFitment,
    fitmentTier: verifiedFitment ? 'verified' : 'fallback',
    partNumberMatch,
    fitmentEvidence: {
      provider: 'eBay',
      matchType: verifiedFitment ? 'EXACT' : null,
      scope: 'year-make-model',
      matchedVehicle: vehicle
        ? {
            year: vehicle.year,
            make: vehicle.make,
            // eBay may list the vehicle under a more specific name than the
            // one selected (RX -> RX350); report the one that matched.
            model: item.matchedModel || vehicle.model,
          }
        : null,
      checkedAt: new Date().toISOString(),
      note: verifiedFitment
        ? 'The marketplace returned an exact year, make, and model compatibility match. Trim, engine, drivetrain, and option-level fitment may still require confirmation.'
        : exactProviderMatch && !titleConsistent
          ? 'The marketplace compatibility response conflicted with the vehicle or model years stated in the listing, so CarPartsRadar did not treat it as a match.'
          : partNumberMatch === 'exact'
            ? 'The listing states the part number you searched. Compatibility with your vehicle was not confirmed.'
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
    link: itemDestination(item) || '',
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

// eBay matches Make case-sensitively; see shared/vehicleMake.js.
export const toEbayMake = normalizeMake

export function buildCompatibilityFilter(ctx) {
  return ctx.year && ctx.make && ctx.model
    ? `Year:${ctx.year};Make:${toEbayMake(ctx.make)};Model:${ctx.model}`
    : undefined
}

// eBay may list a vehicle under several more specific model names than NHTSA
// (RX -> RX350, RX450h). Translate to eBay's spelling; if eBay's list cannot be
// loaded, search with the model exactly as given, as before.
async function resolveEbayModels(ctx) {
  if (!ctx.year || !ctx.make || !ctx.model) return [ctx.model]
  try {
    const ebayModels = await getEbayModels(ctx.year, toEbayMake(ctx.make))
    const { models } = matchEbayModels(ctx.model, ebayModels)
    return models.length > 0 ? models : [ctx.model]
  } catch {
    return [ctx.model]
  }
}

// Take one listing from each model's results in turn, so the first model's
// relevance ranking cannot crowd the others out of the page.
function interleave(batches) {
  const seen = new Set()
  const merged = []
  const longest = Math.max(0, ...batches.map((batch) => batch.length))
  for (let i = 0; i < longest; i += 1) {
    for (const batch of batches) {
      const item = batch[i]
      if (item && !seen.has(item.itemId)) {
        seen.add(item.itemId)
        merged.push(item)
      }
    }
  }
  return merged
}

// eBay documents that compatibility-filtered searches can include POSSIBLE and
// non-matching items. Only EXACT results stay; if none exist, the next tier is
// intentionally unverified.
async function runCompatibleAttempt(token, attempt, affiliate) {
  const outcomes = await Promise.allSettled(
    attempt.compatibilityTargets.map(async (target) => {
      const found = (await runSearch(token, { ...attempt, compatibilityFilter: target.filter, affiliate })).filter(isValidItem)
      return filterExactCompatibility(found).map((item) => ({ ...item, matchedModel: target.model }))
    })
  )
  const fulfilled = outcomes.filter((outcome) => outcome.status === 'fulfilled')
  // One variant failing is tolerable; all of them failing is an eBay failure.
  if (fulfilled.length === 0) throw outcomes[0].reason
  return interleave(fulfilled.map((outcome) => outcome.value))
}

// ctx: { year, make, model, trim, part, query }
export async function search(ctx, { limit = 10, sort = 'price' } = {}) {
  const token = await getAccessToken()

  const partNumber = isLikelyPartNumberQuery(ctx.part)
  const categoryId = ctx.part ? categoryForPart(ctx.part) : undefined
  const models = await resolveEbayModels(ctx)
  const compatibilityTargets = models
    .map((model) => ({ model, filter: buildCompatibilityFilter({ ...ctx, model }) }))
    .filter((target) => target.filter)
  const compatibilityFilter = compatibilityTargets[0]?.filter
  // The category constrains the part type and the compatibility filter
  // constrains the vehicle. A verbose trim label such as "LE Sedan 4-Door"
  // over-narrows eBay's keyword search, so keep the keyword to the part name.

  // Progressively relax: fitment-filtered → category keyword → plain keyword.
  // Each tier trades precision for recall so we still return something useful
  // for vehicles/parts eBay has thin fitment data on.
  const zip = ctx.zip
  const attempts = buildSearchAttempts(ctx, { categoryId, compatibilityFilter, compatibilityTargets, zip, sort })
  const vehicle = {
    year: ctx.year,
    make: ctx.make,
    model: ctx.model,
    // A title naming any eBay variant of the model names the selected model.
    modelAliases: models,
    ...(ctx.trim ? { trim: ctx.trim } : {}),
  }

  let items = []
  let compatibilityFilterUsed = false
  for (const attempt of attempts) {
    const candidates = attempt.compatibilityFilter
      ? await runCompatibleAttempt(token, attempt, ctx.affiliate)
      : (await runSearch(token, { ...attempt, affiliate: ctx.affiliate })).filter(isValidItem)

    if (attempt.partNumberKeyword) {
      // Listings that state the number are what was asked for, whatever
      // vehicle their title also names. Without any, keep only related
      // listings that do not contradict the selected vehicle.
      const stating = candidates.filter((item) => mentionsPartNumber(item, ctx.part))
      items = stating.length > 0 ? stating : filterVehicleContradictions(candidates, vehicle)
    } else {
      // Unknown fitment can remain in a clearly labeled fallback group, but an
      // explicit wrong make, model, or year is never useful. Filter before
      // deciding an attempt succeeded so a contradictory tier cannot prevent a
      // later, more useful fallback attempt from running.
      items = filterVehicleContradictions(candidates, vehicle)
    }
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
      partNumberQuery: partNumber ? ctx.part : null,
    }))
    if (results.length >= limit) break
  }

  return results
}
