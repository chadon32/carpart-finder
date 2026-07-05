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
        await sendPriceDropNotification(alert, search, cheapest.total, cheapest.item)
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
 * Send price drop notification via Resend's HTTP API.
 * Without RESEND_API_KEY this only logs — the trigger is still recorded on
 * the alert row (triggered_at / last_price) so the UI can surface it.
 */
async function sendPriceDropNotification(alert, search, currentPrice, listing) {
  const userId = alert.user_id
  const vehicle = `${search.year} ${search.make} ${search.model}${search.trim ? ` ${search.trim}` : ''}`
  console.log(
    `[Notification] User ${userId}: ${search.part} for ${vehicle} now $${currentPrice.toFixed(2)} — ${listing.link}`
  )

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Notification] RESEND_API_KEY not set; skipping email delivery.')
    return
  }

  // The alert row only stores the user id; the email lives in Supabase Auth.
  const { data, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = data?.user?.email
  if (userError || !email) {
    console.error(`[Notification] Could not resolve email for user ${userId}:`, userError?.message || 'no email on record')
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'CarPartsRadar <onboarding@resend.dev>',
      to: [email],
      subject: `Price drop: ${search.part} for your ${vehicle} — now $${currentPrice.toFixed(2)}`,
      html: `
        <p>Good news — a <strong>${search.part}</strong> matching your saved search for a
        <strong>${vehicle}</strong> just dropped to <strong>$${currentPrice.toFixed(2)}</strong>
        (your target was $${Number(alert.target_price).toFixed(2)}).</p>
        <p><a href="${listing.link}">${listing.title}</a><br/>
        Sold by ${listing.seller}${listing.shippingCost === 0 ? ' · free shipping' : ''}</p>
        <p style="color:#64748b;font-size:12px">You're receiving this because you set a price alert on CarPartsRadar.</p>
      `,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[Notification] Resend API error (${res.status}): ${text}`)
  } else {
    console.log(`[Notification] Price-drop email sent to ${email}`)
  }
}
