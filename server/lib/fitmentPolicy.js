export function totalPrice(listing) {
  const price = Number(listing?.price)
  const shipping = listing?.shippingCost
  if (!Number.isFinite(price) || shipping == null || !Number.isFinite(Number(shipping))) {
    return Infinity
  }
  return price + Number(shipping)
}

export function compareListingsByKnownTotal(a, b) {
  const totalDifference = totalPrice(a) - totalPrice(b)
  if (Number.isFinite(totalDifference) && totalDifference !== 0) return totalDifference
  if (Number.isFinite(totalPrice(a)) !== Number.isFinite(totalPrice(b))) {
    return Number.isFinite(totalPrice(a)) ? -1 : 1
  }

  const priceDifference = Number(a?.price || 0) - Number(b?.price || 0)
  if (priceDifference !== 0) return priceDifference
  return String(a?.id || '').localeCompare(String(b?.id || ''))
}

const VEHICLE_MAKES = [
  'acura', 'alfa romeo', 'audi', 'bentley', 'bmw', 'buick', 'cadillac',
  'chevrolet', 'chrysler', 'dodge', 'fiat', 'ford', 'genesis', 'gmc', 'honda',
  'hummer', 'hyundai', 'infiniti', 'isuzu', 'jaguar', 'jeep', 'kia',
  'land rover', 'lexus', 'lincoln', 'maserati', 'mazda', 'mercedes benz',
  'mercury', 'mini', 'mitsubishi', 'nissan', 'oldsmobile', 'pontiac', 'porsche',
  'ram', 'rolls royce', 'saab', 'saturn', 'scion', 'subaru', 'tesla', 'toyota',
  'volkswagen', 'volvo',
]

function normalizeWords(value) {
  return ` ${String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
}

function containsPhrase(haystack, phrase) {
  const normalizedPhrase = normalizeWords(phrase).trim()
  return normalizedPhrase && haystack.includes(` ${normalizedPhrase} `)
}

function titleYearDoesNotContradictVehicle(title, selectedYear) {
  const year = Number(selectedYear)
  if (!Number.isInteger(year)) return false

  const text = String(title ?? '')
  const ranges = []
  const rangePattern = /\b((?:19|20)\d{2})\s*(?:-|\u2013|\u2014|to|through)\s*((?:19|20)?\d{2})\b/gi
  let match

  while ((match = rangePattern.exec(text)) !== null) {
    const start = Number(match[1])
    const rawEnd = Number(match[2])
    const end = match[2].length === 2
      ? Math.floor(start / 100) * 100 + rawEnd
      : rawEnd

    if (end >= start && end - start <= 40) {
      ranges.push({ start, end })
    }
  }

  if (ranges.some((range) => year >= range.start && year <= range.end)) {
    return true
  }

  const explicitYears = [...text.matchAll(/\b(?:19|20)\d{2}\b/g)]
    .map((yearMatch) => Number(yearMatch[0]))
    .filter((candidate) => candidate >= 1900 && candidate <= 2099)

  // No title year means the structured provider evidence decides. When the
  // title does state model years, however, the selected year must be covered.
  return explicitYears.length === 0 || explicitYears.includes(year)
}

// Provider compatibility data is necessary but not sufficient when the title
// explicitly contradicts it. If a title names the selected model, accept the
// provider's exact match. If it names another make, or names the selected make
// but a different model, fail closed. Generic titles with no vehicle name can
// still rely on the provider's structured exact-match response.
export function titleDoesNotContradictVehicle(title, vehicle) {
  if (!vehicle?.year || !vehicle?.make || !vehicle?.model) return false
  const normalizedTitle = normalizeWords(title)
  const yearConsistent = titleYearDoesNotContradictVehicle(title, vehicle.year)
  if (!yearConsistent) return false
  if (containsPhrase(normalizedTitle, vehicle.model)) return true

  const selectedMake = normalizeWords(vehicle.make).trim()
  const namedMakes = VEHICLE_MAKES.filter((make) => containsPhrase(normalizedTitle, make))
  if (namedMakes.some((make) => make !== selectedMake)) return false
  if (namedMakes.includes(selectedMake)) return false
  return true
}

export function listingDoesNotContradictVehicle(listing, vehicle) {
  return titleDoesNotContradictVehicle(listing?.title, vehicle)
    && (!listing?.shortDescription || titleDoesNotContradictVehicle(listing.shortDescription, vehicle))
}

export function partitionListingsByFitment(listings, limit) {
  const verified = []
  const fallback = []
  const seen = new Set()

  for (const listing of [...listings].sort(compareListingsByKnownTotal)) {
    const key = `${listing.source}:${listing.id || listing.seller}`
    if (seen.has(key)) continue
    seen.add(key)

    const bucket = listing.verifiedFitment === true ? verified : fallback
    if (bucket.length < limit) bucket.push(listing)
  }

  return { verified, fallback }
}
