// Escaping + URL validation for anything that reaches an HTML email body.
// Listing titles, seller names, and links come from eBay sellers, i.e. from
// the public internet. Treat every one of them as hostile.

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  // Single pass over the character class, so `&` cannot double-escape the
  // entities introduced for the other four characters.
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch])
}

// Only an https eBay URL may ever land in an href. Anything else — a
// javascript: scheme, a data: payload, a lookalike host, a redirector — is
// dropped entirely. Anchored on a leading dot or start-of-host so that
// `ebay.com.evil.example` and `notebay.com` both fail.
const ALLOWED_HOST = /(^|\.)ebay\.com$/

export function safeListingUrl(value) {
  if (!value) return null
  let url
  try {
    url = new URL(String(value))
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (!ALLOWED_HOST.test(url.hostname.toLowerCase())) return null
  return url.href
}
