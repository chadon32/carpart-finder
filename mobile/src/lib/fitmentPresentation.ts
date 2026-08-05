import type { Listing } from '@/api/types'

const scopeLabels = {
  'year-make-model': 'Year, make, and model',
  'year-make-model-trim': 'Year, make, model, and trim',
  'keyword-only': 'Keyword only',
} as const

function matchedVehicleLabel(listing: Listing) {
  const vehicle = listing.fitmentEvidence?.matchedVehicle
  if (!vehicle) return null
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')
}

function checkedAtLabel(value: string | null | undefined) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString()
}

export function fitmentPresentation(listing: Listing) {
  const evidence = listing.fitmentEvidence
  const verified = listing.verifiedFitment === true

  return {
    title: verified ? 'Marketplace compatibility match' : 'Compatibility not confirmed',
    description: verified
      ? 'The marketplace returned an exact compatibility result for the selected vehicle fields. Engine, drivetrain, options, dimensions, and the original part number still need your confirmation.'
      : 'This listing came from a broader marketplace search. The marketplace did not confirm compatibility for the selected vehicle.',
    scope: evidence ? scopeLabels[evidence.scope] : 'No structured compatibility evidence',
    provider: evidence?.provider ?? listing.source,
    matchedVehicle: matchedVehicleLabel(listing),
    checkedAt: checkedAtLabel(evidence?.checkedAt),
    checklist: [
      'Match the original part number or manufacturer interchange.',
      'Confirm engine, drivetrain, trim, and installed options.',
      'Review condition, return policy, and seller details before buying.',
    ],
  }
}
