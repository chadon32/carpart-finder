// Maps our part-type names to eBay's automotive leaf category IDs.
// Constraining the search to the correct category (combined with the
// compatibility filter) is what keeps "brake pads" from returning brake
// pedal-pad covers, guide pins, or mis-tagged accessories.
// Discovered empirically via the Browse API's leafCategoryIds field.
export const PART_CATEGORIES = {
  'Brake Pads': '57357', // Brake Pads
  'Brake Rotors': '33564', // Brake Disc Rotors
  'Oil Filter': '33661', // Oil Filters
  'Air Filter': '33659', // Air Filters
  'Cabin Air Filter': '33659', // Air Filters
  Tires: '179680', // Tires
  Battery: '179846', // Batteries
  'Spark Plugs': '174072', // Spark Plugs
  'Transmission Fluid': '33727', // Automatic Transmission Parts
  Coolant: '46096', // Other Engine Cooling Components
  Alternator: '177697', // Alternators & Generators
  Starter: '177699', // Starter Motors
  Radiator: '33602', // Radiators
  'Water Pump': '33604', // Water Pumps
  'Timing Belt': '262137', // Timing Kits
  'Serpentine Belt': '262060', // Belts
  'Headlight Bulb': '71536', // Car Lighting
  'Windshield Wipers': '179852', // Wiper Blades & Refills
  'Shocks and Struts': '33590', // Shocks, Struts & Assemblies
  'CV Axle': '33729', // CV Joints, Boots & Parts
  'Fuel Pump': '33555', // Fuel Pumps & Sending Units
  'Oxygen Sensor': '33557', // Air Intake & Fuel Sensors
  'Catalytic Converter': '33629', // Catalytic Converters
  Muffler: '33636', // Mufflers & Resonators
  'Side Mirror': '33699', // Rear View Mirrors
  'Tie Rod Ends': '33593', // Tie Rods & Steering Linkages
  'Outer Tie Rods': '33593', // Tie Rods & Steering Linkages
  'Control Arm': '33564', // Control Arms & Parts (falls back well anyway)
  Thermostat: '46096', // Other Engine Cooling Components
  'Ignition Coil': '262183', // Ignition Coils
  'Wheel Bearing': '171422', // Wheel Hubs & Bearings
  'Fuel Injector': '33549', // Fuel Injectors
  'Mass Air Flow Sensor': '33557', // Air Intake & Fuel Sensors
}

// Broad "Car & Truck Parts & Accessories" parent, used when a part type
// isn't in the map above so the compatibility filter can still apply.
export const FALLBACK_CATEGORY = '6030'

export function categoryForPart(part) {
  return PART_CATEGORIES[part] || FALLBACK_CATEGORY
}
