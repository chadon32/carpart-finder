import { EBAY_API_ROOT, getAccessToken } from './ebayAuth.js'
import { fetchWithRetry } from './httpClient.js'

const TAXONOMY_URL = `${EBAY_API_ROOT}/commerce/taxonomy/v1`

// "Car & Truck Parts & Accessories" - broad enough to cover any part type
// and returns the same vehicle-level compatibility values (Trim, Engine, etc.)
// regardless of which specific part category the user ends up searching.
const PARTS_CATEGORY_ID = '6030'

let categoryTreeId = null
let treeIdExpiresAt = 0
let treeIdPromise = null

async function getMotorsCategoryTreeId() {
  if (categoryTreeId && Date.now() < treeIdExpiresAt) {
    return categoryTreeId
  }

  if (treeIdPromise) {
    return treeIdPromise
  }

  treeIdPromise = (async () => {
    try {
      const token = await getAccessToken()
      const res = await fetchWithRetry(
        `${TAXONOMY_URL}/get_default_category_tree_id?marketplace_id=EBAY_MOTORS_US`,
        { headers: { Authorization: `Bearer ${token}` } },
        { timeoutMs: 6000, retries: 2 }
      )
      if (!res.ok) throw new Error(`eBay category tree lookup failed (${res.status})`)

      const data = await res.json()
      categoryTreeId = data.categoryTreeId
      treeIdExpiresAt = Date.now() + 24 * 60 * 60 * 1000
      return categoryTreeId
    } finally {
      treeIdPromise = null
    }
  })()

  return treeIdPromise
}

const trimCache = new Map()
const trimPromises = new Map()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function getTrims(year, make, model) {
  const key = `${year}::${make.toLowerCase()}::${model.toLowerCase()}`
  const cached = trimCache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  if (trimPromises.has(key)) {
    return trimPromises.get(key)
  }

  const promise = (async () => {
    try {
      const treeId = await getMotorsCategoryTreeId()
      const token = await getAccessToken()

      const params = new URLSearchParams({
        category_id: PARTS_CATEGORY_ID,
        compatibility_property: 'Trim',
        filter: `Year:${year},Make:${make},Model:${model}`,
      })

      const res = await fetchWithRetry(
        `${TAXONOMY_URL}/category_tree/${treeId}/get_compatibility_property_values?${params}`,
        { headers: { Authorization: `Bearer ${token}` } },
        { timeoutMs: 7000, retries: 1 }
      )

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`eBay trim lookup failed (${res.status}): ${text}`)
      }

      const data = await res.json()
      const trims = (data.compatibilityPropertyValues || []).map((v) => v.value).sort()

      trimCache.set(key, { data: trims, expiresAt: Date.now() + CACHE_TTL_MS })
      return trims
    } finally {
      trimPromises.delete(key)
    }
  })()

  trimPromises.set(key, promise)
  return promise
}
