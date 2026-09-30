// NHTSA returns makes in upper case ("HONDA"). eBay's compatibility_filter
// matches Make against its own casing ("Honda") exactly, so an upper-case make
// silently returns zero EXACT matches, and people would rather read "Honda"
// than "HONDA" anyway. One spelling serves both, so the web app, the API, and
// the mobile app all go through this function.

// The NHTSA makes where title case is not eBay's spelling, taken from eBay's
// Taxonomy Make values (EBAY_MOTORS_US, category 6030) on 2026-09-29.
const MAKE_EXCEPTIONS = {
  'AM GENERAL': 'AM General',
  'AMERICAN LAFRANCE': 'American LaFrance',
  BMW: 'BMW',
  BRIGHTDROP: 'BrightDrop',
  BYD: 'BYD',
  DELOREAN: 'DeLorean',
  FWD: 'FWD',
  GMC: 'GMC',
  INEOS: 'INEOS',
  INFINITI: 'INFINITI',
  MCLAREN: 'McLaren',
  UD: 'UD',
  VINFAST: 'VinFast',
  WHITEGMC: 'White/GMC',
}

// Three letters or fewer reads as an acronym (BMW, RPM, MG) unless it is one
// of the few short names that are ordinary words.
const SHORT_WORD_MAKES = new Set(['KIA', 'RAM', 'GEO'])

const PLAIN_BRAND_NAME = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/

export function normalizeMake(make) {
  if (make == null) return ''
  const text = String(make).trim().replace(/\s+/g, ' ')
  if (!text) return ''

  const upper = text.toUpperCase()
  if (Object.hasOwn(MAKE_EXCEPTIONS, upper)) return MAKE_EXCEPTIONS[upper]

  // NHTSA also lists coachbuilders and kit-car firms with punctuation, digits,
  // or company suffixes. eBay has no compatibility data for them, and
  // re-casing "S.T.I" or "(CCC)" would only mangle them, so leave them alone.
  if (!PLAIN_BRAND_NAME.test(text)) return text

  if (!/[ -]/.test(text) && text.length <= 3 && !SHORT_WORD_MAKES.has(upper)) return upper

  return upper.toLowerCase().replace(/(^|[ -])\p{L}/gu, (letter) => letter.toUpperCase())
}
