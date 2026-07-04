import { EBAY_API_ROOT, getAccessToken, isConfigured } from '../ebayAuth.js'
import { categoryForPart } from '../partCategories.js'
import { fetchWithRetry } from '../httpClient.js'

const SEARCH_URL = `${EBAY_API_ROOT}/buy/browse/v1/item_summary/search`
const ITEM_URL = `${EBAY_API_ROOT}/buy/browse/v1/item`

export { isConfigured }

// Fetches the current price + availability for specific eBay item ids so the
// cart can detect price drops or sold-out items since they were saved.
// ids are the app's prefixed ids ("ebay-v1|123|0"); the eBay itemId is the rest.
export async function getCurrentPrices(ids) {
  const token = await getAccessToken()

  const entries = await Promise.all(
    ids.map(async (id) => {
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
  )

  const map = {}
  for (const [id, value] of entries) {
    if (value) map[id] = value
  }
  return map
}

const BASE_FILTER =
  'buyingOptions:{FIXED_PRICE},itemLocationCountry:US,deliveryCountry:US,conditionIds:{1000|1500|2000|2500|3000}'

async function runSearch(token, { q, categoryId, compatibilityFilter, zip }) {
  const params = new URLSearchParams({
    q,
    sort: 'price',
    limit: '50',
    fieldgroups: 'EXTENDED',
    filter: BASE_FILTER,
  })
  if (categoryId) params.set('category_ids', categoryId)
  if (compatibilityFilter) params.set('compatibility_filter', compatibilityFilter)

  const headers = {
    Authorization: `Bearer ${token}`,
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
  }
  // Buyer ZIP makes eBay return location-accurate shipping cost + delivery dates.
  // The header value must be URL-encoded or eBay ignores the location.
  if (zip) {
    headers['X-EBAY-C-ENDUSERCTX'] = `contextualLocation=${encodeURIComponent(`country=US,zip=${zip}`)}`
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

function mapItem(item, { verifiedFitment }) {
  return {
    id: `ebay-${item.itemId}`,
    verifiedFitment,
    title: item.title,
    price: Number(item.price?.value ?? 0),
    currency: item.price?.currency ?? 'USD',
    condition: item.condition ?? 'Not specified',
    seller: item.seller?.username || 'Unknown seller',
    sellerFeedbackPercentage: item.seller?.feedbackPercentage ?? null,
    sellerFeedbackScore: item.seller?.feedbackScore ?? null,
    image: item.image?.imageUrl ?? null,
    link: item.itemWebUrl,
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

// ctx: { year, make, model, trim, part, query }
export async function search(ctx, { limit = 10 } = {}) {
  const token = await getAccessToken()

  const categoryId = ctx.part ? categoryForPart(ctx.part) : undefined
  const compatibilityFilter =
    ctx.year && ctx.make && ctx.model ? `Year:${ctx.year};Make:${ctx.make};Model:${ctx.model}` : undefined
  // Keyword is just the part name (+ trim) — the category constrains the part
  // type and the compatibility filter constrains fitment, so we don't want the
  // full "year make model" string over-narrowing to listings that mention it.
  const q = [ctx.part, ctx.trim].filter(Boolean).join(' ').trim() || ctx.query

  // Progressively relax: fitment-filtered → category keyword → plain keyword.
  // Each tier trades precision for recall so we still return something useful
  // for vehicles/parts eBay has thin fitment data on.
  const zip = ctx.zip
  const attempts = [
    { q, categoryId, compatibilityFilter, zip },
    { q, categoryId, zip },
    { q: ctx.query, categoryId: undefined, compatibilityFilter: undefined, zip },
  ]

  let items = []
  let verifiedFitment = false
  for (const attempt of attempts) {
    items = (await runSearch(token, attempt)).filter(isValidItem)
    if (items.length > 0) {
      // Only tier 1 runs eBay's compatibility filter; results from the relaxed
      // tiers are keyword matches whose fitment the user must verify themselves.
      verifiedFitment = Boolean(attempt.compatibilityFilter)
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
    results.push(mapItem(item, { verifiedFitment }))
    if (results.length >= limit) break
  }

  return results
}
