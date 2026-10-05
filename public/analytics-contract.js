// Closed first-party vocabulary. Neither URLs nor user-entered text belong here.
export const VISIT_EVENTS = Object.freeze([
  'Page Viewed',
  'Vehicle Selected',
  'Search Started',
  'Search Results Viewed',
  'Search Failed',
  'Listing Opened',
  'Retailer Clicked',
  'Added to Watchlist',
  'Price Alert Created',
  'Generated AI Repair Guide',
  'comparison_checklist_shared',
  'guide_search_started',
  'part_identification_demo',
])
export const VISIT_PAGES = Object.freeze([
  'home',
  'part-selection',
  'results',
  'watchlist',
  'guides',
  'guide',
  'about',
  'methodology',
  'contact',
  'privacy',
  'terms',
  'affiliate-disclosure',
  'other',
])
export const VISIT_SOURCES = Object.freeze(['direct', 'search', 'social', 'referral'])
export const VISIT_DEVICES = Object.freeze(['phone', 'tablet', 'desktop'])
export const VISIT_RETAILERS = Object.freeze([
  'amazon',
  'ebay',
  'autozone',
  'rockauto',
  'oreilly',
  'napa',
  'advance-auto-parts',
  'walmart',
  'summit-racing',
  'google-shopping',
  'aliexpress',
  'other',
])
export const VISIT_SESSION_IDLE_MS = 30 * 60 * 1000
export const VISIT_BATCH_LIMIT = 20
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isVisitId(value) {
  return typeof value === 'string' && UUID.test(value)
}

export function visitProperties(name, input = {}) {
  const safe = {}
  if (name === 'Page Viewed' && VISIT_PAGES.includes(input.page)) safe.page = input.page
  if (name === 'Retailer Clicked') {
    safe.retailerId = VISIT_RETAILERS.includes(input.retailerId) ? input.retailerId : 'other'
  }
  if (name === 'Search Results Viewed') safe.hasResults = input.hasResults === true
  return safe
}

export function validateVisitBatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  if (
    !isVisitId(input.sessionId) ||
    !VISIT_DEVICES.includes(input.device) ||
    !VISIT_SOURCES.includes(input.source)
  )
    return null
  if (
    !Array.isArray(input.events) ||
    !input.events.length ||
    input.events.length > VISIT_BATCH_LIMIT
  )
    return null
  const events = []
  for (const event of input.events) {
    if (!event || !isVisitId(event.id) || !VISIT_EVENTS.includes(event.name)) return null
    if (
      event.properties != null &&
      (typeof event.properties !== 'object' || Array.isArray(event.properties))
    )
      return null
    events.push({
      id: event.id,
      name: event.name,
      properties: visitProperties(event.name, event.properties || {}),
    })
  }
  return { sessionId: input.sessionId, device: input.device, source: input.source, events }
}

export function visitSource(referrer, currentOrigin) {
  if (!referrer) return 'direct'
  try {
    const url = new URL(referrer)
    if (url.origin === currentOrigin) return 'direct'
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (
      /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|brave\.com)$/.test(host)
    )
      return 'search'
    if (
      /(^|\.)(facebook\.com|instagram\.com|tiktok\.com|t\.co|twitter\.com|x\.com|reddit\.com|youtube\.com|linkedin\.com|pinterest\.com)$/.test(
        host,
      )
    )
      return 'social'
    return 'referral'
  } catch {
    return 'direct'
  }
}
