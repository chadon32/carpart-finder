import crypto from 'node:crypto'

// AliExpress Open Platform uses the classic "TOP" (Taobao Open Platform) signing
// convention: sort all request params by key, concatenate key+value pairs, wrap
// with the app secret on both ends, then MD5 and uppercase.
// Docs: https://openservice.aliexpress.com/doc/doc.htm
const GATEWAY_URL = 'https://api-sg.aliexpress.com/sync'

export const isConfigured = () =>
  Boolean(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET && process.env.ALIEXPRESS_TRACKING_ID)

function sign(params, appSecret) {
  const sorted = Object.keys(params).sort()
  const base = sorted.map((key) => `${key}${params[key]}`).join('')
  const signed = `${appSecret}${base}${appSecret}`
  return crypto.createHash('md5').update(signed, 'utf8').digest('hex').toUpperCase()
}

function chinaTimestamp() {
  // AliExpress expects the timestamp in China Standard Time (UTC+8).
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`
}

// ctx: { year, make, model, trim, part, query }
export async function search(ctx, { limit = 10 } = {}) {
  const query = typeof ctx === 'string' ? ctx : ctx.query
  const appKey = process.env.ALIEXPRESS_APP_KEY
  const appSecret = process.env.ALIEXPRESS_APP_SECRET
  const trackingId = process.env.ALIEXPRESS_TRACKING_ID

  if (!appKey || !appSecret || !trackingId) {
    throw new Error('Missing ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET, or ALIEXPRESS_TRACKING_ID in server/.env')
  }

  const params = {
    method: 'aliexpress.affiliate.product.query',
    app_key: appKey,
    timestamp: chinaTimestamp(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5',
    keywords: query,
    tracking_id: trackingId,
    sort: 'SALE_PRICE_ASC',
    page_no: '1',
    page_size: String(Math.max(limit, 20)),
    target_currency: 'USD',
    target_language: 'EN',
    ship_to_country: 'US',
  }

  params.sign = sign(params, appSecret)

  const res = await fetch(`${GATEWAY_URL}?${new URLSearchParams(params).toString()}`)

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AliExpress search failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const errorResponse = data.error_response
  if (errorResponse) {
    throw new Error(`AliExpress API error: ${errorResponse.msg || errorResponse.code}`)
  }

  const result = data.aliexpress_affiliate_product_query_response?.resp_result?.result
  const products = result?.products?.product || []

  const seenSellers = new Set()
  const results = []

  for (const product of products) {
    const seller = product.shop_id ? `Shop ${product.shop_id}` : 'AliExpress seller'
    if (seenSellers.has(seller)) continue
    seenSellers.add(seller)

    results.push({
      id: `aliexpress-${product.product_id}`,
      title: product.product_title,
      price: Number(product.target_sale_price ?? product.sale_price ?? 0),
      currency: product.target_sale_price_currency ?? 'USD',
      condition: 'New',
      seller,
      sellerFeedbackPercentage: product.evaluate_rate ?? null,
      image: product.product_main_image_url ?? null,
      link: product.product_detail_url,
      source: 'AliExpress',
      crossBorder: true,
      shipsFrom: 'Overseas (China)',
      estimatedDelivery: '2-6 weeks',
    })

    if (results.length >= limit) break
  }

  return results
}
