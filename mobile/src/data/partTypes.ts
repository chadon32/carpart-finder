export type PartType = {
  name: string
  popular: boolean
  // Parts tagged 'ice' require a combustion engine and don't exist on
  // battery-electric vehicles (spark plugs, oil filter, muffler, etc).
  // Untagged (or 'all') parts apply to every powertrain.
  powertrain?: 'ice'
  // Parts commonly replaced in the same job. Names must exactly match another
  // entry's `name` — companions run through the same category mapping and
  // powertrain filter as a hand-picked search.
  companions?: string[]
}

export const partTypes: PartType[] = [
  { name: 'Brake Pads', popular: true, companions: ['Brake Rotors'] },
  { name: 'Brake Rotors', popular: true, companions: ['Brake Pads'] },
  { name: 'Oil Filter', popular: true, powertrain: 'ice', companions: ['Air Filter', 'Cabin Air Filter'] },
  { name: 'Air Filter', popular: true, powertrain: 'ice', companions: ['Cabin Air Filter', 'Oil Filter'] },
  { name: 'Cabin Air Filter', popular: false, companions: ['Air Filter'] },
  { name: 'Tires', popular: true },
  { name: 'Battery', popular: true, companions: ['Alternator'] },
  { name: 'Spark Plugs', popular: true, powertrain: 'ice', companions: ['Ignition Coil'] },
  { name: 'Transmission Fluid', popular: false, powertrain: 'ice' },
  { name: 'Coolant', popular: false, companions: ['Thermostat'] },
  { name: 'Alternator', popular: false, powertrain: 'ice', companions: ['Serpentine Belt', 'Battery'] },
  { name: 'Starter', popular: false, powertrain: 'ice', companions: ['Battery'] },
  { name: 'Radiator', popular: false, powertrain: 'ice', companions: ['Coolant', 'Thermostat'] },
  { name: 'Water Pump', popular: false, powertrain: 'ice', companions: ['Timing Belt', 'Coolant', 'Thermostat'] },
  { name: 'Timing Belt', popular: false, powertrain: 'ice', companions: ['Water Pump', 'Coolant'] },
  { name: 'Serpentine Belt', popular: false, powertrain: 'ice', companions: ['Alternator', 'Water Pump'] },
  { name: 'Headlight Bulb', popular: false },
  { name: 'Windshield Wipers', popular: true },
  { name: 'Shocks and Struts', popular: false, companions: ['Control Arm'] },
  { name: 'CV Axle', popular: false, companions: ['Wheel Bearing'] },
  { name: 'Fuel Pump', popular: false, powertrain: 'ice', companions: ['Fuel Injector'] },
  { name: 'Oxygen Sensor', popular: false, powertrain: 'ice', companions: ['Catalytic Converter'] },
  { name: 'Catalytic Converter', popular: false, powertrain: 'ice', companions: ['Oxygen Sensor', 'Muffler'] },
  { name: 'Muffler', popular: false, powertrain: 'ice', companions: ['Catalytic Converter'] },
  { name: 'Side Mirror', popular: false },
  { name: 'Outer Tie Rods', popular: false, companions: ['Tie Rod Ends', 'Control Arm'] },
  { name: 'Tie Rod Ends', popular: false, companions: ['Outer Tie Rods', 'Control Arm'] },
  { name: 'Control Arm', popular: false, companions: ['Outer Tie Rods', 'Shocks and Struts'] },
  { name: 'Thermostat', popular: false, powertrain: 'ice', companions: ['Coolant', 'Radiator'] },
  { name: 'Ignition Coil', popular: false, powertrain: 'ice', companions: ['Spark Plugs'] },
  { name: 'Wheel Bearing', popular: false, companions: ['CV Axle', 'Brake Rotors'] },
  { name: 'Fuel Injector', popular: false, powertrain: 'ice', companions: ['Fuel Pump', 'Spark Plugs'] },
  { name: 'Mass Air Flow Sensor', popular: false, powertrain: 'ice', companions: ['Air Filter'] },
]

export function partTypesForVehicle(isElectric: boolean): PartType[] {
  return isElectric ? partTypes.filter((p) => p.powertrain !== 'ice') : partTypes
}

export function popularPartTypesForVehicle(isElectric: boolean): PartType[] {
  return partTypesForVehicle(isElectric).filter((p) => p.popular)
}

// Companions for a part, EV-filtered the same way the part grid is. Unknown
// part names (free-text searches) simply return [] — never a fabricated list.
export function companionsForPart(part: string, isElectric: boolean): string[] {
  const target = part.trim().toLowerCase()
  const entry = partTypes.find((p) => p.name.toLowerCase() === target)
  if (!entry?.companions) return []
  const allowed = new Set(partTypesForVehicle(isElectric).map((p) => p.name))
  return entry.companions.filter((name) => allowed.has(name))
}

// Cross-reference integrity: every companion must name a real part type, or it
// silently produces a broken search category. Warn loudly in dev, never throw.
if (__DEV__) {
  const names = new Set(partTypes.map((p) => p.name))
  for (const p of partTypes) {
    for (const c of p.companions ?? []) {
      if (!names.has(c)) console.warn(`[partTypes] "${p.name}" lists unknown companion "${c}"`)
    }
  }
}
