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
// and "no match found" is just as stable, so we cache both outcomes.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const cache = new Map()

async function resolveTitle(query) {
  const params = new URLSearchParams({ action: 'opensearch', search: query, limit: '1', format: 'json' })
  const res = await fetchWithRetry(`${WIKI_API}?${params}`, { headers: { 'User-Agent': USER_AGENT } }, IMG_FETCH_OPTS)
  if (!res.ok) return null
  const data = await res.json()
  return data?.[1]?.[0] || null
}

// A model's curated "hero" photo from its Wikipedia article — cleanest option.
async function fromWikipediaArticle(make, model) {
  const title = await resolveTitle(`${make} ${model}`)
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
async function fromCommonsSearch(make, model) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${make} ${model}`,
    gsrnamespace: '6', // File namespace
    gsrlimit: '5',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: '500',
  })
  const res = await fetchWithRetry(`${COMMONS_API}?${params}`, { headers: { 'User-Agent': USER_AGENT } }, IMG_FETCH_OPTS)
  if (!res.ok) return null
  const data = await res.json()
  const pages = data?.query?.pages ? Object.values(data.query.pages) : []
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

export async function getVehicleImage(make, model) {
  const key = `${make}::${model}`.toLowerCase()
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.imageUrl
  }

  let imageUrl = null
  try {
    imageUrl = (await fromWikipediaArticle(make, model)) || (await fromCommonsSearch(make, model))
  } catch {
    // Treat any failure as "no image available" rather than surfacing an error —
    // this is a cosmetic enhancement, not core functionality.
    imageUrl = null
  }

  cache.set(key, { imageUrl, expiresAt: Date.now() + CACHE_TTL_MS })
  return imageUrl
}
