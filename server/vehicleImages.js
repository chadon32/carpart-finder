import { fetchWithRetry } from './httpClient.js'

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const WIKI_SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary'
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'

// Cosmetic feature: fail fast, no retries — a missing thumbnail just falls
// back to the car icon, so it's not worth delaying the UI over.
const IMG_FETCH_OPTS = { timeoutMs: 5000, retries: 0 }

// Wikipedia asks API consumers to identify themselves. See:
// https://meta.wikimedia.org/wiki/User-Agent_policy
const USER_AGENT = 'CarPartFinder/1.0 (personal project; contact via GitHub)'

// Long-lived cache: a model's representative photo essentially never changes,
// and "no match found" is just as stable, so we cache both outcomes. Capped,
// because the key space is derived from user-supplied query params — an
// uncapped Map here grows without bound. Mirrors search.js's LRU.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CACHE_SIZE = Number(process.env.MAX_IMAGE_CACHE_SIZE) || 500
const cache = new Map()
const imagePromises = new Map()

// Simple LRU eviction: delete the oldest entry when over the limit.
function evictOldestIfNeeded() {
  if (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    cache.delete(oldestKey)
  }
}

async function resolveTitle(query) {
  const params = new URLSearchParams({ action: 'opensearch', search: query, limit: '1', format: 'json' })
  const res = await fetchWithRetry(`${WIKI_API}?${params}`, { headers: { 'User-Agent': USER_AGENT } }, IMG_FETCH_OPTS)
  if (!res.ok) return null
  const data = await res.json()
  return data?.[1]?.[0] || null
}

// A model's curated "hero" photo from its Wikipedia article — cleanest option.
async function fromWikipediaArticle(query) {
  const title = await resolveTitle(query)
  if (!title) return null
  
  const res = await fetchWithRetry(
    `${WIKI_SUMMARY}/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    { headers: { 'User-Agent': USER_AGENT } },
    IMG_FETCH_OPTS
  )
  if (!res.ok) return null
  const data = await res.json()
  return data?.thumbnail?.source || null
}

// Broad fallback: search Wikimedia Commons' photo library directly. Covers the
// long tail of models (and newer ones) that lack a good Wikipedia article image.
async function fromCommonsSearch(query) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6', // File namespace
    gsrlimit: '5',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '500',
  })
  const res = await fetchWithRetry(`${COMMONS_API}?${params}`, { headers: { 'User-Agent': USER_AGENT } }, IMG_FETCH_OPTS)
  if (!res.ok) return null
  const data = await res.json()
  let pages = data?.query?.pages ? Object.values(data.query.pages) : []
  
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  for (const page of pages) {
    const info = page.imageinfo?.[0]
    // Only real raster photos (skip SVG logos, diagrams, PDFs, etc.).
    if (info?.thumburl && /^image\/(jpeg|png|webp)$/.test(info.mime || '')) {
      return info.thumburl
    }
  }
  return null
}

export async function getVehicleImage(make, model, year) {
  const key = year ? `${year}::${make}::${model}`.toLowerCase() : `${make}::${model}`.toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.imageUrl
  }

  if (imagePromises.has(key)) {
    return imagePromises.get(key)
  }

  const promise = (async () => {
    let imageUrl = null
    try {
      if (year) {
        // Try year-specific searches first
        imageUrl = (await fromCommonsSearch(`${year} ${make} ${model}`)) || (await fromWikipediaArticle(`${year} ${make} ${model}`))
      }
      
      // If no year was provided, or year-specific searches failed, fall back to generic searches
      if (!imageUrl) {
        imageUrl = (await fromWikipediaArticle(`${make} ${model}`)) || (await fromCommonsSearch(`${make} ${model}`))
      }
    } catch {
      // Treat any failure as "no image available" rather than surfacing an error —
      // this is a cosmetic enhancement, not core functionality.
      imageUrl = null
    }

    evictOldestIfNeeded()
    cache.set(key, { imageUrl, expiresAt: Date.now() + CACHE_TTL_MS })
    return imageUrl
  })().finally(() => {
    // Without this, one in-flight promise leaked per unique make::model, and
    // the map was never drained for the process's lifetime.
    imagePromises.delete(key)
  })

  imagePromises.set(key, promise)
  return promise
}
