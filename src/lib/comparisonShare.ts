import type { Listing } from '../api/client'
import type { Car } from '../components/CarSelector'
import { knownTotalCost } from './listingHelpers'
import { safeRetailerUrl } from '../../shared/outboundUrl.js'

export const FITMENT_SCOPE_LABELS = {
  'year-make-model': 'Year, make, and model',
  'year-make-model-trim': 'Year, make, model, and trim',
  'keyword-only': 'Keyword-only',
} as const

const VIN_PATTERN = /\b[A-HJ-NPR-Z0-9]{17}\b/gi
const LABELLED_VIN_PATTERN = /\b(?:vin|vehicle identification number)\s*[:#-]?\s*[A-HJ-NPR-Z0-9-]{11,20}\b/gi
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi

export function privacySafeShareValue(value: unknown) {
  return String(value ?? '')
    .replace(LABELLED_VIN_PATTERN, '[redacted VIN]')
    .replace(VIN_PATTERN, '[redacted VIN]')
    .replace(EMAIL_PATTERN, '[redacted email]')
}

export function privacySafeRetailerUrl(value: unknown) {
  const safeUrl = safeRetailerUrl(value)
  if (!safeUrl) return null
  try {
    const decodedUrl = decodeURIComponent(safeUrl)
    return privacySafeShareValue(safeUrl) === safeUrl && privacySafeShareValue(decodedUrl) === decodedUrl
      ? safeUrl
      : null
  } catch {
    return null
  }
}

export function formatComparisonMoney(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}` : 'Unavailable'
}

export function formatComparisonTimestamp(value: string | null | undefined) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return date.toISOString()
}

export function comparisonFitmentLabel(listing: Listing) {
  if (listing.verifiedFitment === true) {
    const scope = listing.fitmentEvidence?.scope
    return `Structured compatibility evidence: ${scope ? FITMENT_SCOPE_LABELS[scope] : 'scope unavailable'}`
  }
  return 'Keyword match only: compatibility not confirmed'
}

export function comparisonShippingLabel(listing: Listing) {
  if (listing.shippingCost === 0) return 'Free shipping'
  return formatComparisonMoney(listing.shippingCost)
}

export function comparisonCoreChargeLabel(listing: Listing) {
  return formatComparisonMoney(listing.coreCharge)
}

export function comparisonFitmentCheckedTimestamp(listing: Listing) {
  return formatComparisonTimestamp(listing.fitmentEvidence?.checkedAt)
}

export function comparisonListingFreshnessLabel(listing: Listing) {
  return formatComparisonTimestamp(listing.listedAt)
}

export function buildComparisonShareText({
  vehicle,
  part,
  listings,
}: {
  vehicle: Car
  part: string
  listings: Listing[]
}) {
  const vehicleLabel = privacySafeShareValue([vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '))
  const rows = listings.map((listing, index) => {
    const total = knownTotalCost(listing)
    const safeUrl = privacySafeRetailerUrl(listing.link)
    return [
      `${index + 1}. ${privacySafeShareValue(listing.title || 'Listing')}`,
      `Retailer: ${privacySafeShareValue(listing.source || 'Unavailable')}`,
      `Fitment evidence checked: ${comparisonFitmentCheckedTimestamp(listing)}`,
      `Listing freshness: ${comparisonListingFreshnessLabel(listing)}`,
      `Item price: ${formatComparisonMoney(listing.price)}`,
      `Known shipping: ${comparisonShippingLabel(listing)}`,
      `Core charge: ${comparisonCoreChargeLabel(listing)}`,
      `Item + known shipping, before tax: ${formatComparisonMoney(total)}`,
      `Fitment evidence: ${comparisonFitmentLabel(listing)}`,
      `Confirm at retailer: ${safeUrl ?? 'Link unavailable'}`,
    ].join('\n')
  })

  return [
    'CarPartsRadar comparison checklist',
    `Vehicle: ${vehicleLabel}`,
    `Part: ${privacySafeShareValue(part)}`,
    '',
    ...rows,
    '',
    'Before buying:',
    '[ ] Confirm the exact vehicle configuration and original part number.',
    '[ ] Confirm fitment, condition, quantity, included hardware, and return terms with the retailer.',
    '[ ] Review shipping, core terms, tax, and the final checkout total.',
    '',
    'This is a comparison snapshot from the search response. Prices, inventory, delivery, and fitment can change. Structured compatibility evidence is evidence, not a guarantee. A keyword match does not establish compatibility. CarPartsRadar does not guarantee fitment, price, inventory, delivery, or savings.',
    'Affiliate disclosure: CarPartsRadar may earn a commission from qualifying retailer purchases. This does not change the comparison or guarantee fitment.',
  ].join('\n')
}
