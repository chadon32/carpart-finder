const isSandbox = process.env.EBAY_ENV === 'sandbox'
export const EBAY_API_ROOT = isSandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'

export const isConfigured = () => Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET)

let cachedToken = null
let tokenExpiresAt = 0

export async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET in server/.env')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${EBAY_API_ROOT}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`eBay OAuth failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  cachedToken = data.access_token
  // Refresh a minute early to avoid edge-of-expiry failures.
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}
