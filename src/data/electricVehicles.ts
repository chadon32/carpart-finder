// There's no NHTSA lookup for fuel type by year/make/model (only full VIN
// decode, which we don't have), so this is a maintained list of known
// battery-electric vehicles. It won't catch brand-new models we haven't
// added yet, but it covers the large majority of EVs on the road.
//
// Plug-in hybrids (Prius Prime, RAV4 Prime, etc.) are intentionally excluded
// here — they still have a combustion engine and need spark plugs, oil, etc.

// Makes that sell electric-only lineups.
const ALL_ELECTRIC_MAKES = new Set(['tesla', 'rivian', 'lucid', 'polestar', 'fisker'])

// Specific EV nameplates from manufacturers that also sell gas/hybrid vehicles.
const ELECTRIC_MODEL_KEYWORDS = [
  'mach-e',
  'f-150 lightning',
  'lightning',
  'bolt ev',
  'bolt euv',
  'blazer ev',
  'equinox ev',
  'silverado ev',
  'leaf',
  'ariya',
  'ioniq 5',
  'ioniq 6',
  'kona electric',
  'ev6',
  'ev9',
  'niro ev',
  'soul ev',
  'id.4',
  'id.buzz',
  'e-tron',
  'i3',
  'i4',
  'ix',
  'i7',
  'eqs',
  'eqe',
  'eqb',
  'eqa',
  'xc40 recharge',
  'ex30',
  'ex90',
  'lyriq',
  'hummer ev',
  'mx-30',
  'cooper se',
  'i-pace',
  'taycan',
  'bz4x',
  'solterra',
  'prologue',
  'e-transit',
]

export function isElectricVehicle(make: string, model: string): boolean {
  const m = make.trim().toLowerCase()
  if (ALL_ELECTRIC_MAKES.has(m)) return true

  const modelLower = model.trim().toLowerCase()
  return ELECTRIC_MODEL_KEYWORDS.some((kw) => modelLower.includes(kw))
}
