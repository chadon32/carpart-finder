export type GuideSearchStart = {
  id: string
  title: string
  part: string
}

// Guide links carry only one of these opaque, editorially owned identifiers.
// The part is a reviewable starting suggestion, never a diagnosis or a
// vehicle-specific conclusion. Keep this map small and explicit so an edited
// guide cannot smuggle raw search text into the app or analytics.
export const GUIDE_SEARCH_STARTS: Record<string, GuideSearchStart> = {
  'how-to-confirm-car-part-fitment': {
    id: 'how-to-confirm-car-part-fitment',
    title: 'How to Confirm a Car Part Fits Before You Buy',
    part: 'Brake Pads',
  },
  'oem-vs-aftermarket-car-parts': {
    id: 'oem-vs-aftermarket-car-parts',
    title: 'OEM vs. Aftermarket Car Parts: How to Choose',
    part: 'Brake Pads',
  },
  'brake-pad-buying-guide': {
    id: 'brake-pad-buying-guide',
    title: 'Brake Pad Buying Guide: Fit, Material, and Total Cost',
    part: 'Brake Pads',
  },
  'alternator-buying-guide': {
    id: 'alternator-buying-guide',
    title: 'Alternator Buying Guide: Output, Fitment, and Core Charges',
    part: 'Alternator',
  },
  'starter-motor-buying-guide': {
    id: 'starter-motor-buying-guide',
    title: 'Starter Motor Buying Guide: Diagnose First, Then Match',
    part: 'Starter',
  },
  'oxygen-sensor-buying-guide': {
    id: 'oxygen-sensor-buying-guide',
    title: 'Oxygen Sensor Buying Guide: Bank, Position, and Connector',
    part: 'Oxygen Sensor',
  },
  'shocks-vs-struts-buying-guide': {
    id: 'shocks-vs-struts-buying-guide',
    title: 'Shocks vs. Struts: What to Check Before Ordering',
    part: 'Shocks and Struts',
  },
  'compare-total-car-part-cost': {
    id: 'compare-total-car-part-cost',
    title: 'How to Compare the Real Cost of an Online Car Part',
    part: 'Brake Pads',
  },
}

const GUIDE_BY_PART: Record<string, GuideSearchStart> = {
  'brake pads': GUIDE_SEARCH_STARTS['how-to-confirm-car-part-fitment'],
  alternator: GUIDE_SEARCH_STARTS['alternator-buying-guide'],
  starter: GUIDE_SEARCH_STARTS['starter-motor-buying-guide'],
  'oxygen sensor': GUIDE_SEARCH_STARTS['oxygen-sensor-buying-guide'],
  'shocks and struts': GUIDE_SEARCH_STARTS['shocks-vs-struts-buying-guide'],
}

export function guideSearchStart(id: string | null | undefined): GuideSearchStart | null {
  if (!id) return null
  return GUIDE_SEARCH_STARTS[id] ?? null
}

export function guideForPart(part: string | null | undefined): GuideSearchStart | null {
  const normalized = part?.trim().toLowerCase()
  return normalized ? GUIDE_BY_PART[normalized] ?? null : null
}
