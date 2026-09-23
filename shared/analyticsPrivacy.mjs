// Analytics receives only values from these closed vocabularies. Callers may
// pass raw form, vehicle, listing, or account-adjacent fields, but this module
// never returns those values to the analytics SDK.

// These IDs mirror the exact user-facing categories in src/data/partTypes.ts.
// Free-text/OEM searches intentionally resolve to "other".
const PART_CATEGORY_IDS = Object.freeze({
  'brake pads': 'brake-pads',
  'brake rotors': 'brake-rotors',
  'oil filter': 'oil-filter',
  'air filter': 'air-filter',
  'cabin air filter': 'cabin-air-filter',
  tires: 'tires',
  battery: 'battery',
  'spark plugs': 'spark-plugs',
  'transmission fluid': 'transmission-fluid',
  coolant: 'coolant',
  alternator: 'alternator',
  starter: 'starter',
  radiator: 'radiator',
  'water pump': 'water-pump',
  'timing belt': 'timing-belt',
  'serpentine belt': 'serpentine-belt',
  'headlight bulb': 'headlight-bulb',
  'windshield wipers': 'windshield-wipers',
  'shocks and struts': 'shocks-and-struts',
  'cv axle': 'cv-axle',
  'fuel pump': 'fuel-pump',
  'oxygen sensor': 'oxygen-sensor',
  'catalytic converter': 'catalytic-converter',
  muffler: 'muffler',
  'side mirror': 'side-mirror',
  'outer tie rods': 'outer-tie-rods',
  'tie rod ends': 'tie-rod-ends',
  'control arm': 'control-arm',
  thermostat: 'thermostat',
  'ignition coil': 'ignition-coil',
  'wheel bearing': 'wheel-bearing',
  'fuel injector': 'fuel-injector',
  'mass air flow sensor': 'mass-air-flow-sensor',
})

// Keep this closed list synchronized with src/data/guideSearch.ts. A guide
// event may contain only one of these editorial identifiers.
const GUIDE_IDS = new Set([
  'how-to-confirm-car-part-fitment',
  'oem-vs-aftermarket-car-parts',
  'brake-pad-buying-guide',
  'alternator-buying-guide',
  'starter-motor-buying-guide',
  'oxygen-sensor-buying-guide',
  'shocks-vs-struts-buying-guide',
  'compare-total-car-part-cost',
])

const RETAILER_IDS = Object.freeze({
  amazon: 'amazon',
  'amazon.com': 'amazon',
  ebay: 'ebay',
  'ebay.com': 'ebay',
  autozone: 'autozone',
  rockauto: 'rockauto',
  oreilly: 'oreilly',
  'o\'reilly': 'oreilly',
  'o\'reilly auto parts': 'oreilly',
  napa: 'napa',
  'advance auto': 'advance-auto-parts',
  'advance auto parts': 'advance-auto-parts',
  walmart: 'walmart',
  'summit racing': 'summit-racing',
  summitracing: 'summit-racing',
  'google shopping': 'google-shopping',
  aliexpress: 'aliexpress',
})

const PLACEMENTS = new Set([
  'listing',
  'listing-detail',
  'store-comparison',
  'watchlist',
  'watchlist-compare',
])

const FITMENT_STATUSES = new Set(['verified', 'unverified'])
const COMPANION_LOCATIONS = new Set(['results-aside', 'detail-modal'])
const DEMO_ACTIONS = new Set(['viewed', 'open_tool'])

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function lookupId(table, value, fallback = 'other') {
  const candidate = normalized(value)
  return Object.prototype.hasOwnProperty.call(table, candidate) ? table[candidate] : fallback
}

export function partCategoryId(value) {
  return lookupId(PART_CATEGORY_IDS, value)
}

export function guideId(value) {
  const candidate = normalized(value)
  return GUIDE_IDS.has(candidate) ? candidate : null
}

export function retailerId(value) {
  return lookupId(RETAILER_IDS, value)
}

export function placementId(value) {
  const candidate = normalized(value)
  return PLACEMENTS.has(candidate) ? candidate : 'other'
}

export function fitmentStatusId(value) {
  const candidate = normalized(value)
  return FITMENT_STATUSES.has(candidate) ? candidate : 'unknown'
}

export function companionLocationId(value) {
  const candidate = normalized(value)
  return COMPANION_LOCATIONS.has(candidate) ? candidate : 'other'
}

export function boundedCount(value) {
  return Number.isInteger(value) ? Math.max(0, Math.min(20, value)) : 0
}

export function priceBucket(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'unknown'
  if (value < 50) return 'under-50'
  if (value < 150) return '50-149'
  if (value < 500) return '150-499'
  return '500-plus'
}

function vehicleSelected(properties) {
  return Boolean(normalized(properties?.year) && normalized(properties?.make) && normalized(properties?.model))
}

function safePartSearch(properties) {
  return {
    partCategoryId: partCategoryId(properties?.part),
    vehicleSelected: vehicleSelected(properties),
    trimSelected: Boolean(normalized(properties?.trim)),
  }
}

export function sanitizeAnalyticsEvent(eventName, properties = {}) {
  properties = properties && typeof properties === 'object' ? properties : {}
  switch (eventName) {
    case 'Searched Part':
      return { name: eventName, properties: safePartSearch(properties) }
    case 'Search Results Viewed':
      return {
        name: eventName,
        properties: {
          partCategoryId: partCategoryId(properties.part),
          verifiedCount: boundedCount(properties.verifiedCount),
          fallbackCount: boundedCount(properties.fallbackCount),
          hasResults: boundedCount(properties.verifiedCount) + boundedCount(properties.fallbackCount) > 0,
          stale: properties.stale === true,
        },
      }
    case 'Retailer Clicked':
      return {
        name: eventName,
        properties: {
          retailerId: retailerId(properties.retailer),
          placement: placementId(properties.placement),
          fitmentStatus: fitmentStatusId(properties.fitmentStatus),
        },
      }
    case 'Companion Part Clicked':
      return {
        name: eventName,
        properties: {
          fromPartCategoryId: partCategoryId(properties.from),
          toPartCategoryId: partCategoryId(properties.to),
          placement: companionLocationId(properties.location),
        },
      }
    case 'Generated AI Repair Guide':
      return {
        name: eventName,
        properties: {
          partCategoryId: partCategoryId(properties.part),
          vehicleSelected: Boolean(normalized(properties.vehicleLabel)),
        },
      }
    case 'Added to Watchlist':
      return {
        name: eventName,
        properties: {
          partCategoryId: partCategoryId(properties.part),
          retailerId: retailerId(properties.source),
          priceBucket: priceBucket(properties.price),
        },
      }
    case 'Price Alert Created':
      return {
        name: eventName,
        properties: {
          partCategoryId: partCategoryId(properties.part),
          targetPriceBucket: priceBucket(properties.targetPrice),
        },
      }
    case 'comparison_checklist_shared':
      return {
        name: eventName,
        properties: {
          listingCount: boundedCount(properties.listingCount),
          structuredEvidenceCount: boundedCount(properties.structuredEvidenceCount),
          keywordMatchCount: boundedCount(properties.keywordMatchCount),
          knownTotalCount: boundedCount(properties.knownTotalCount),
          retailerLinkCount: boundedCount(properties.retailerLinkCount),
        },
      }
    case 'guide_search_started': {
      const id = guideId(properties.guideId)
      if (!id) return null
      return {
        name: eventName,
        properties: {
          guideId: id,
          partCategoryId: partCategoryId(properties.partCategoryId || properties.partCategory),
        },
      }
    }
    case 'part_identification_demo':
      if (properties.demoId !== 'parts-workbench-v1' || !DEMO_ACTIONS.has(properties.action)) return null
      return {
        name: eventName,
        properties: {
          demoId: 'parts-workbench-v1',
          action: properties.action,
        },
      }
    default:
      return null
  }
}
