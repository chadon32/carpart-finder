/**
 * Price Checker Worker
 *
 * Re-runs each active alert's saved search against eBay and compares the
 * cheapest live listing (price + shipping) to the alert's target price.
 * Covers both account alerts (price_alerts) and guest email subscriptions
 * (guest_alerts). Alerts are one-shot: a trigger deactivates the alert so
 * the same drop doesn't fire an email every day.
 * Scheduled via Vercel Cron hitting /api/cron/check-alerts (see vercel.json).
 */

import { supabaseAdmin, isMockMode, accountsAvailable } from '../supabase.js'
import { search as ebaySearch, isConfigured as ebayConfigured } from '../providers/ebay.js'

// Runs one alert's search and returns the cheapest out-of-pocket option,
// matching what the UI shows (price + shipping). null = no live listings.
async function findCheapest(searchLike) {
  const ctx = {
    year: searchLike.year,
    make: searchLike.make,
    model: searchLike.model,
    trim: searchLike.trim || undefined,
    part: searchLike.part,
    query: `${searchLike.year} ${searchLike.make} ${searchLike.model} ${searchLike.part}`.trim(),
  }
  const listings = await ebaySearch(ctx, { limit: 3 })
  if (listings.length === 0) return null
  return listings.reduce((best, item) => {
    const total = item.price + (item.shippingCost || 0)
    return total < best.total ? { total, item } : best
  }, { total: Infinity, item: null })
}

export async function checkPriceAlerts() {
  console.log('[PriceChecker] Starting price check...')

  if (isMockMode) {
    console.warn('⚠️ [PriceChecker] Running in LOCAL MOCK MODE. Skipping Supabase DB lookup.')
    return { checked: 0, triggered: 0, skipped: 'mock mode' }
  }

  // supabaseAdmin is null when accounts are disabled. Without this the cron
  // would throw on `.from()` of null.
  if (!accountsAvailable || !supabaseAdmin) {
    console.warn('⚠️ [PriceChecker] Accounts are disabled (Supabase unconfigured). Skipping price check.')
    return { checked: 0, triggered: 0, skipped: 'accounts unavailable' }
  }

  if (!ebayConfigured()) {
    console.warn('⚠️ [PriceChecker] eBay API is not configured. Skipping price check.')
    return { checked: 0, triggered: 0, skipped: 'ebay not configured' }
  }

  let checked = 0
  let triggered = 0

  // ---- Account alerts (price_alerts joined to saved_searches) ----
  const { data: alerts, error } = await supabaseAdmin
    .from('price_alerts')
    .select('*, saved_searches(*)')
    .eq('is_active', true)

  if (error) {
    console.error('[PriceChecker] Error fetching alerts:', error)
  }

  // Sequential on purpose: parallel fan-out would burn the eBay rate limit
  // and each search already runs its own internal retry/relaxation tiers.
  for (const alert of alerts || []) {
    const search = alert.saved_searches
    if (!search) continue

    try {
      const cheapest = await findCheapest(search)
      checked++

      const update = { last_checked_at: new Date().toISOString() }

      if (cheapest) {
        update.last_price = cheapest.total
        if (cheapest.total <= Number(alert.target_price)) {
          triggered++
          console.log(
            `[PriceChecker] PRICE DROP for alert #${alert.id}: $${cheapest.total.toFixed(2)} <= target $${alert.target_price} — ${cheapest.item.title}`
          )
          update.triggered_at = new Date().toISOString()
          update.is_active = false
          const email = await resolveUserEmail(alert.user_id)
          if (email) await sendPriceDropEmail(email, alert.target_price, search, cheapest.total, cheapest.item)
        }
      }

      await supabaseAdmin.from('price_alerts').update(update).eq('id', alert.id)
    } catch (err) {
      console.error(`[PriceChecker] Error checking alert #${alert.id}:`, err.message)
    }
  }

  // ---- Guest alerts (email-only, no account) ----
  const { data: guestAlerts, error: guestError } = await supabaseAdmin
    .from('guest_alerts')
    .select('*')
    .eq('is_active', true)

  if (guestError) {
    console.error('[PriceChecker] Error fetching guest alerts:', guestError)
  }

  for (const alert of guestAlerts || []) {
    try {
      const cheapest = await findCheapest(alert)
      checked++

      const update = { last_checked_at: new Date().toISOString() }

      if (cheapest) {
        update.last_price = cheapest.total
        if (cheapest.total <= Number(alert.target_price)) {
          triggered++
          console.log(
            `[PriceChecker] PRICE DROP for guest alert #${alert.id}: $${cheapest.total.toFixed(2)} <= target $${alert.target_price} — ${cheapest.item.title}`
          )
          update.triggered_at = new Date().toISOString()
          update.is_active = false
          await sendPriceDropEmail(alert.email, alert.target_price, alert, cheapest.total, cheapest.item)
        }
      }

      await supabaseAdmin.from('guest_alerts').update(update).eq('id', alert.id)
    } catch (err) {
      console.error(`[PriceChecker] Error checking guest alert #${alert.id}:`, err.message)
    }
  }

  console.log(`[PriceChecker] Done. Checked ${checked}, triggered ${triggered}.`)
  return { checked, triggered }
}

// Account alerts only store the user id; the email lives in Supabase Auth.
async function resolveUserEmail(userId) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  const email = data?.user?.email
  if (error || !email) {
    console.error(`[Notification] Could not resolve email for user ${userId}:`, error?.message || 'no email on record')
    return null
  }
  return email
}

/**
 * Send a price-drop email via Resend's HTTP API.
 * Without RESEND_API_KEY this only logs — the trigger is still recorded on
 * the alert row (triggered_at / last_price) so the UI can surface it.
 */
async function sendPriceDropEmail(email, targetPrice, searchLike, currentPrice, listing) {
  const vehicle = `${searchLike.year} ${searchLike.make} ${searchLike.model}${searchLike.trim ? ` ${searchLike.trim}` : ''}`
  console.log(
    `[Notification] ${email}: ${searchLike.part} for ${vehicle} now $${currentPrice.toFixed(2)} — ${listing.link}`
  )

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Notification] RESEND_API_KEY not set; skipping email delivery.')
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
      subject: `Price drop: ${searchLike.part} for your ${vehicle} — now $${currentPrice.toFixed(2)}`,
      html: `
        <p>Good news — a <strong>${searchLike.part}</strong> matching your price alert for a
        <strong>${vehicle}</strong> just dropped to <strong>$${currentPrice.toFixed(2)}</strong>
        (your target was $${Number(targetPrice).toFixed(2)}).</p>
        <p><a href="${listing.link}">${listing.title}</a><br/>
        Sold by ${listing.seller}${listing.shippingCost === 0 ? ' · free shipping' : ''}</p>
        <p style="color:#64748b;font-size:12px">You're receiving this because you set a price alert on CarPartsRadar.
        This alert has now been fulfilled and won't email you again.</p>
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
