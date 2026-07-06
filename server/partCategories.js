// Maps our part-type names to eBay's automotive leaf category IDs.
// Constraining the search to the correct category (combined with the
// compatibility filter) is what keeps "brake pads" from returning brake
// pedal-pad covers, guide pins, or mis-tagged accessories.
export const PART_CATEGORIES = {
  // Legacy mappings
  'Brake Pads': '57357',
  'Brake Rotors': '33564',
  'Oil Filter': '33661',
  'Air Filter': '33659',
  'Cabin Air Filter': '33659',
  'Tires': '179680',
  'Battery': '179846',
  'Spark Plugs': '174072',
  'Transmission Fluid': '33727',
  'Coolant': '46096',
  'Alternator': '177697',
  'Starter': '177699',
  'Radiator': '33602',
  'Water Pump': '33604',
  'Timing Belt': '262137',
  'Serpentine Belt': '262060',
  'Headlight Bulb': '71536',
  'Windshield Wipers': '179852',
  'Shocks and Struts': '33590',
  'CV Axle': '33729',
  'Fuel Pump': '33555',
  'Oxygen Sensor': '33557',
  'Catalytic Converter': '33629',
  'Muffler': '33636',
  'Side Mirror': '33699',
  'Tie Rod Ends': '33593',
  'Outer Tie Rods': '33593',
  'Control Arm': '33564',
  'Ball Joint': '33580',
  'Thermostat': '46096',
  'Ignition Coil': '262183',
  'Wheel Bearing': '171422',
  'Fuel Injector': '33549',
  'Mass Air Flow Sensor': '33557',
  
  // New AI-Generated mappings
  "Brake Calipers": "33563",
  "Brake Shoes": "61739",
  "Brake Drums": "33565",
  "Master Cylinder": "33566",
  "Fuel Filter": "33660",
  "Transmission Filter": "33662",
  "Wheels": "179679",
  "Spark Plug Wires": "33692",
  "Cooling Fan": "33600",
  "Timing Chain": "262135",
  "Drive Belt Tensioner": "262061",
  "Tail Light Bulb": "172517",
  "Fog Light": "33709",
  "Turn Signal Assembly": "33717",
  "Wiper Motor": "61941",
  "Washer Fluid Pump": "174112",
  "Coil Springs": "33582",
  "Sway Bar Links": "33592",
  "Drive Shaft": "262251",
  "Hub Assembly": "170141",
  "Throttle Body": "33558",
  "Exhaust Manifold": "33632",
  "Rear View Mirror": "33699",
  "Window Regulator": "33706",
  "Door Handle": "179851",
  "Engine Mount": "50454",
  "Transmission Mount": "262258",
  "Oil Pan": "38657",
  "Valve Cover Gasket": "33665",
  "Head Gasket": "33665",
  "AC Compressor": "33543",
  "AC Condenser": "61864",
  "Heater Core": "262081",
  "Blower Motor": "33546"
}

// Broad "Car & Truck Parts & Accessories" parent, used when a part type
// isn't in the map above so the compatibility filter can still apply.
export const FALLBACK_CATEGORY = '6030'

export function categoryForPart(part) {
  if (!part) return FALLBACK_CATEGORY

  const normalized = part.toLowerCase().trim()
  
  // 1. Exact match (case insensitive)
  for (const [key, value] of Object.entries(PART_CATEGORIES)) {
    if (key.toLowerCase() === normalized) {
      return value
    }
  }

  // 2. Fuzzy Match: If the AI output contains the category name (e.g. "Front Ball Joint" -> "Ball Joint")
  // or if the category name contains the AI output (e.g. "Brake Pad" -> "Brake Pads")
  for (const [key, value] of Object.entries(PART_CATEGORIES)) {
    const lowerKey = key.toLowerCase()
    if (normalized.includes(lowerKey) || lowerKey.includes(normalized)) {
      return value
    }
  }

  return FALLBACK_CATEGORY
}
