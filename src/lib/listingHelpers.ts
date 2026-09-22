import type { Listing } from '../api/client'

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function deliveryLabel(l: Listing, effectiveZip?: string) {
  if (!l.deliveryMin && !l.deliveryMax) return null
  try {
    const min = l.deliveryMin ? new Date(l.deliveryMin) : null
    const max = l.deliveryMax ? new Date(l.deliveryMax) : null
    if (min && isNaN(min.getTime())) return null
    if (max && isNaN(max.getTime())) return null

    if (min && max && min.toDateString() !== max.toDateString()) {
      if (min.getMonth() === max.getMonth()) {
        return `Arrives ${dateFmt.format(min)}–${max.getDate()}${effectiveZip ? ` to ${effectiveZip}` : ''}`
      }
      return `Arrives ${dateFmt.format(min)}–${dateFmt.format(max)}${effectiveZip ? ` to ${effectiveZip}` : ''}`
    }
    const d = max || min
    return d ? `Arrives ${dateFmt.format(d)}${effectiveZip ? ` to ${effectiveZip}` : ''}` : null
  } catch {
    return null
  }
}

export function shippingLabel(l: Listing) {
  if (l.shippingCost == null) return null
  return l.shippingCost === 0 ? 'Free shipping' : `+$${l.shippingCost.toFixed(2)} shipping`
}

export function isNew(l: Listing) {
  return l.condition?.toLowerCase().startsWith('new')
}
export function isUsed(l: Listing) {
  const c = l.condition?.toLowerCase() ?? ''
  return c.includes('used') || c.includes('refurb')
}

export function knownTotalCost(l: Listing): number | null {
  if (l.shippingCost == null || !Number.isFinite(l.shippingCost)) return null
  return l.price + l.shippingCost
}

export function compareKnownTotal(a: Listing, b: Listing) {
  const aTotal = knownTotalCost(a)
  const bTotal = knownTotalCost(b)
  if (aTotal == null && bTotal == null) return a.price - b.price || a.id.localeCompare(b.id)
  if (aTotal == null) return 1
  if (bTotal == null) return -1
  return aTotal - bTotal || a.price - b.price || a.id.localeCompare(b.id)
}

export function valueScore(l: Listing) {
  const total = knownTotalCost(l)
  if (total == null) return Infinity
  const pct = l.sellerFeedbackPercentage ? Number(l.sellerFeedbackPercentage) : 92
  const trust = Math.min(100, Math.max(80, pct))
  const penalty = (100 - trust) / 100
  let effective = total * (1 + penalty)
  if (l.topRatedSeller) effective *= 0.95
  return effective
}

export function compareValueEstimate(a: Listing, b: Listing) {
  return valueScore(a) - valueScore(b) || compareKnownTotal(a, b)
}
