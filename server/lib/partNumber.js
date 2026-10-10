// OEM and aftermarket part numbers behave differently from part names: they
// identify one item, so the vehicle is secondary, and eBay's keyword search is
// sensitive to how the separators are written.

// One token, 5-24 characters, at least two digits: "26350-2T000", "WL10657",
// "04465-0K010". A name such as "Brake Pads" or a bare year never qualifies.
export function isLikelyPartNumberQuery(part) {
  const raw = String(part ?? '').trim()
  const compact = raw.replace(/[^a-z0-9]/gi, '')
  const digitCount = (compact.match(/\d/g) ?? []).length
  return !/\s/.test(raw) && compact.length >= 5 && compact.length <= 24 && digitCount >= 2
}

export const partNumberKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// The number as typed, then with its separators as spaces ("26350 2T000"),
// which finds the listings that write it differently.
export function partNumberQueryVariants(part) {
  const typed = String(part ?? '').trim()
  const spaced = typed.replace(/[^a-z0-9]+/gi, ' ').trim()
  return spaced && spaced !== typed ? [typed, spaced] : [typed]
}

// True when the listing's own text states the number, ignoring separators and
// case. Short keys are refused so a stray "A01" can never match everything.
export function mentionsPartNumber(listing, part) {
  const key = partNumberKey(part)
  if (key.length < 5) return false
  return partNumberKey([listing?.title, listing?.shortDescription].filter(Boolean).join(' ')).includes(key)
}
