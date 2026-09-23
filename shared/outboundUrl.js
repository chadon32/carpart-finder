const RETAILER_DOMAINS = Object.freeze([
  'ebay.com',
  'ebay.ca',
  'ebay.co.uk',
  'ebay.de',
  'ebay.com.au',
  'amazon.com',
  'amazon.ca',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.it',
  'amazon.es',
  'amazon.com.au',
  'amazon.co.jp',
  'autozone.com',
  'rockauto.com',
  'oreillyauto.com',
  'napaonline.com',
  'advanceautoparts.com',
  'walmart.com',
  'summitracing.com',
  'google.com',
  'aliexpress.com',
])

function isRetailerHost(hostname) {
  const normalized = hostname.toLowerCase()
  return RETAILER_DOMAINS.some((domain) => (
    normalized === domain || normalized.endsWith(`.${domain}`)
  ))
}

/** Returns a normalized HTTPS retailer URL, or null for unsafe destinations. */
export function safeRetailerUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || !isRetailerHost(url.hostname)) {
      return null
    }
    return url.href
  } catch {
    return null
  }
}
