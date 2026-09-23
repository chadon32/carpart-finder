function normalize(value) {
  return ` ${String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `
}

function containsPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase).trim()
  return Boolean(normalizedPhrase) && text.includes(` ${normalizedPhrase} `)
}

function containsAny(text, phrases) {
  return phrases.some((phrase) => containsPhrase(text, phrase))
}

// These rules are deliberately conservative. They apply only to marketplace
// keyword fallbacks, never to a provider's explicit compatibility match. When
// we do not recognize a requested part, we keep the fallback rather than risk
// hiding a valid custom or OE-number search.
const PART_RULES = [
  {
    matches: (part) => /\bbrake pads?\b/.test(part),
    primary: ['brake pad', 'brake pads', 'disc pad', 'disc pads', 'pad set', 'brake kit'],
    accessoryOnly: /\b(?:brake\s+pads?\s+(?:hardware|clip|clips|retainer|shim|wear\s+sensor|sensor|tool)|brake\s+pad\s+(?:shoes?\s+)?accessor(?:y|ies)|(?:caliper|pedal)\s+(?:pad|cover))\b/i,
  },
  {
    matches: (part) => /\bbrake rotors?\b/.test(part),
    primary: ['brake rotor', 'brake rotors', 'brake disc', 'brake discs', 'disc rotor', 'rotor set'],
    accessoryOnly: /\b(?:rotor\s+(?:screw|clip|retainer|tool)|brake\s+rotor\s+(?:screw|hardware))\b/i,
  },
  {
    matches: (part) => /\boil filters?\b/.test(part),
    primary: ['oil filter', 'oil filters'],
    accessoryOnly: /\b(?:oil\s+filter\s+(?:wrench|socket|cap|housing|adapter))\b/i,
  },
  {
    matches: (part) => /\b(?:cabin|pollen) air filters?\b/.test(part),
    primary: ['cabin air filter', 'pollen filter', 'cabin filter'],
    accessoryOnly: /\b(?:cabin\s+filter\s+(?:cover|clip|tool))\b/i,
  },
  {
    matches: (part) => /\bair filters?\b/.test(part),
    primary: ['air filter', 'air cleaner'],
    accessoryOnly: /\b(?:air\s+filter\s+(?:cover|clip|housing|adapter))\b/i,
  },
  {
    matches: (part) => /\bspark plugs?\b/.test(part),
    primary: ['spark plug', 'spark plugs'],
    accessoryOnly: /\b(?:spark\s+plug\s+(?:wire|boot|socket|tool|gap))\b/i,
  },
  {
    matches: (part) => /\b(?:oxygen|o2) sensors?\b/.test(part),
    primary: ['oxygen sensor', 'o2 sensor', 'lambda sensor'],
    accessoryOnly: /\b(?:(?:oxygen|o2)\s+sensor\s+(?:socket|tool|extension))\b/i,
  },
  {
    matches: (part) => /\bwindshield wipers?\b/.test(part),
    primary: ['windshield wiper', 'wiper blade', 'wiper blades'],
    accessoryOnly: /\b(?:wiper\s+(?:arm|refill|adapter|clip))\b/i,
  },
  {
    matches: (part) => /\b(?:cv|drive) axles?\b/.test(part),
    primary: ['cv axle', 'drive axle', 'axle shaft'],
    accessoryOnly: /\b(?:axle\s+(?:nut|boot|tool|seal))\b/i,
  },
  {
    matches: (part) => /\bwheel bearings?\b/.test(part),
    primary: ['wheel bearing', 'hub bearing', 'hub assembly'],
    accessoryOnly: /\b(?:wheel\s+bearing\s+(?:tool|grease|seal|nut))\b/i,
  },
]

function isLikelyPartNumberQuery(part) {
  const raw = String(part ?? '').trim()
  const compact = raw.replace(/[^a-z0-9]/gi, '')
  const digitCount = (compact.match(/\d/g) ?? []).length
  return !/\s/.test(raw) && compact.length >= 5 && compact.length <= 24 && digitCount >= 2
}

function ruleForPart(part) {
  const normalizedPart = normalize(part).trim()
  return PART_RULES.find((rule) => rule.matches(normalizedPart)) ?? null
}

export function listingMatchesPartIntent(listing, part) {
  if (isLikelyPartNumberQuery(part)) return true

  const rule = ruleForPart(part)
  if (!rule) return true

  const text = normalize([listing?.title, listing?.shortDescription].filter(Boolean).join(' '))
  if (!containsAny(text, rule.primary)) return false
  return !rule.accessoryOnly.test(text)
}

export function filterListingsByPartIntent(listings, part) {
  return listings.filter((listing) => listingMatchesPartIntent(listing, part))
}
