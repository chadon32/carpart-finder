// Which axle a listing is for, read from its title. Marketplace data has no
// reliable position field, so a title that does not say stays unknown rather
// than being guessed.

// 'front' | 'rear' | 'kit' (front and rear together) | null
export function listingPosition(title) {
  const text = String(title ?? '').toLowerCase()
  const front = /\bfront\b|\bfrt\b/.test(text)
  const rear = /\brear\b/.test(text)
  if (front && rear) return 'kit'
  if (front) return 'front'
  if (rear) return 'rear'
  return null
}

const PER_AXLE_PART =
  /\b(?:brake pads?|brake rotors?|brake discs?|rotors?|brake calipers?|brake shoes?|brake drums?|brake lines?|brake hoses?|shocks?|struts?|control arms?|ball joints?|tie rods?|wheel bearings?|wheel hubs?|hub assembly|coil springs?|sway bar|stabilizer|cv axles?|axle shafts?)\b/i

export function isPositionSensitivePart(part) {
  return PER_AXLE_PART.test(String(part ?? ''))
}

const ORDER = ['front', 'rear', 'kit']

// The axle choices to offer, in display order. Empty unless this is a per-axle
// part and the listings really include more than one axle.
export function positionChoices(listings, part) {
  if (!isPositionSensitivePart(part)) return []
  const present = new Set()
  for (const listing of listings ?? []) {
    const position = listingPosition(listing?.title)
    if (position) present.add(position)
  }
  return present.size >= 2 ? ORDER.filter((position) => present.has(position)) : []
}
