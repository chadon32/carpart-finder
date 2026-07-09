import { supabaseAdmin, accountsAvailable } from './supabase.js'

// Real observed prices only: one row per (vehicle, part) per day holding the
// lowest total (price + shipping) actually seen that day. This is the honest
// replacement for the fabricated trend chart removed in 27904e6.

export function normalizeSignature({ year, make, model, part }) {
  const norm = (s) => String(s ?? '').trim().toLowerCase()
  return { year: String(year ?? '').trim(), make: norm(make), model: norm(model), part: norm(part) }
}

// Never throws and never blocks meaningfully: callers await it (Vercel may
// freeze the function after the response is sent, so fire-and-forget writes
// can be silently dropped), but a failure only logs.
export async function recordPriceObservation({ year, make, model, part, total }) {
  if (!accountsAvailable || !supabaseAdmin) return { recorded: false }
  const price = Number(total)
  if (!Number.isFinite(price) || price <= 0) return { recorded: false }
  const sig = normalizeSignature({ year, make, model, part })
  if (!sig.year || !sig.make || !sig.model || !sig.part) return { recorded: false }
  const observedDate = new Date().toISOString().slice(0, 10)

  try {
    const { data: existing, error: selectError } = await supabaseAdmin
      .from('price_history')
      .select('id, price')
      .eq('year', sig.year)
      .eq('make', sig.make)
      .eq('model', sig.model)
      .eq('part', sig.part)
      .eq('observed_date', observedDate)
      .maybeSingle()
    if (selectError) throw selectError

    if (!existing) {
      // A concurrent insert can race this; the unique index makes the loser
      // error, which lands in the catch below — acceptable, the day's row exists.
      const { error } = await supabaseAdmin
        .from('price_history')
        .insert({ ...sig, observed_date: observedDate, price })
      if (error) throw error
    } else if (price < Number(existing.price)) {
      const { error } = await supabaseAdmin.from('price_history').update({ price }).eq('id', existing.id)
      if (error) throw error
    }
    return { recorded: true }
  } catch (err) {
    // A history write must never break search or the cron.
    console.error('[priceHistory] record failed:', err?.message)
    return { recorded: false }
  }
}

export async function getPriceHistory({ year, make, model, part }, { days = 90 } = {}) {
  if (!accountsAvailable || !supabaseAdmin) return []
  const sig = normalizeSignature({ year, make, model, part })
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('price_history')
    .select('observed_date, price')
    .eq('year', sig.year)
    .eq('make', sig.make)
    .eq('model', sig.model)
    .eq('part', sig.part)
    .gte('observed_date', since)
    .order('observed_date', { ascending: true })
  if (error) {
    console.error('[priceHistory] read failed:', error.message)
    return []
  }
  return (data || []).map((r) => ({ date: r.observed_date, price: Number(r.price) }))
}
