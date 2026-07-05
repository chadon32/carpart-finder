/**
 * Price Checker Worker
 *
 * Re-runs each active alert's saved search against eBay and compares the
 * cheapest live listing (price + shipping) to the alert's target price.
 * Scheduled via Vercel Cron hitting /api/cron/check-alerts (see vercel.json).
 */

import { supabaseAdmin, isMockMode } from '../supabase.js'
import { search as ebaySearch, isConfigured as ebayConfigured } from '../providers/ebay.js'

export async function checkPriceAlerts() {
  console.log('[PriceChecker] Starting price check...')

  if (isMockMode) {
    console.warn('⚠️ [PriceChecker] Running in LOCAL MOCK MODE. Skipping Supabase DB lookup.')
    return { checked: 0, triggered: 0, skipped: 'mock mode' }
  }

  if (!ebayConfigured()) {
    console.warn('⚠️ [PriceChecker] eBay API is not configured. Skipping price check.')
    return { checked: 0, triggered: 0, skipped: 'ebay not configured' }
  }

  const { data: alerts, error } = await supabaseAdmin
    .from('price_alerts')
    .select('*, saved_searches(*)')
    .eq('is_active', true)

  if (error) {
    console.error('[PriceChecker] Error fetching alerts:', error)
    return { checked: 0, triggered: 0, error: error.message }
  }

  if (!alerts || alerts.length === 0) {
    console.log('[PriceChecker] No active alerts found.')
    return { checked: 0, triggered: 0 }
  }

  console.log(`[PriceChecker] Checking ${alerts.length} active alerts...`)

  let checked = 0
  let triggered = 0

  // Sequential on purpose: parallel fan-out would burn the eBay rate limit
  // and each search already runs its own internal retry/relaxation tiers.
  for (const alert of alerts) {
    const search = alert.saved_searches
    if (!search) continue

    try {
      const ctx = {
        year: search.year,
        make: search.make,
        model: search.model,
        trim: search.trim || undefined,
        part: search.part,
        query: `${search.year} ${search.make} ${search.model} ${search.part}`.trim(),
      }

      const listings = await ebaySearch(ctx, { limit: 3 })
      checked++

      if (listings.length === 0) {
        console.log(`[PriceChecker] Alert #${alert.id}: no live listings found for "${ctx.query}"`)
        await supabaseAdmin
          .from('price_alerts')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', alert.id)
        continue
      }

      // Compare on true out-of-pocket cost, matching what the UI shows.
      const cheapest = listings.reduce((best, item) => {
        const total = item.price + (item.shippingCost || 0)
        return total < best.total ? { total, item } : best
      }, { total: Infinity, item: null })

      const update = {
        last_checked_at: new Date().toISOString(),
        last_price: cheapest.total,
      }

      if (cheapest.total <= Number(alert.target_price)) {
        triggered++
        console.log(
          `[PriceChecker] PRICE DROP for alert #${alert.id}: $${cheapest.total.toFixed(2)} <= target $${alert.target_price} — ${cheapest.item.title}`
        )
        update.triggered_at = new Date().toISOString()
        await sendPriceDropNotification(alert.user_id, search, cheapest.total, cheapest.item)
      }

      await supabaseAdmin.from('price_alerts').update(update).eq('id', alert.id)
    } catch (err) {
      console.error(`[PriceChecker] Error checking alert #${alert.id}:`, err.message)
    }
  }

  console.log(`[PriceChecker] Done. Checked ${checked}, triggered ${triggered}.`)
  return { checked, triggered }
}

/**
 * Send price drop notification.
 * Email delivery is not wired up yet — needs a transactional email service
 * (e.g. Resend) and its API key. Until then the trigger is recorded on the
 * alert row (triggered_at / last_price) so the UI can surface it.
 */
async function sendPriceDropNotification(userId, search, currentPrice, listing) {
  console.log(
    `[Notification] User ${userId}: ${search.part} for ${search.year} ${search.make} ${search.model} now $${currentPrice.toFixed(2)} — ${listing.link}`
  )
}
