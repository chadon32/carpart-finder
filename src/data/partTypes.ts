export type PartType = {
  name: string
  popular: boolean
  // Parts tagged 'ice' require a combustion engine and don't exist on
  // battery-electric vehicles (spark plugs, oil filter, muffler, etc).
  // Untagged (or 'all') parts apply to every powertrain.
  powertrain?: 'ice'
}

export const partTypes: PartType[] = [
  { name: 'Brake Pads', popular: true },
  { name: 'Brake Rotors', popular: true },
  { name: 'Oil Filter', popular: true, powertrain: 'ice' },
  { name: 'Air Filter', popular: true, powertrain: 'ice' },
  { name: 'Cabin Air Filter', popular: false },
  { name: 'Tires', popular: true },
  { name: 'Battery', popular: true },
  { name: 'Spark Plugs', popular: true, powertrain: 'ice' },
  { name: 'Transmission Fluid', popular: false, powertrain: 'ice' },
  { name: 'Coolant', popular: false },
  { name: 'Alternator', popular: false, powertrain: 'ice' },
  { name: 'Starter', popular: false, powertrain: 'ice' },
  { name: 'Radiator', popular: false, powertrain: 'ice' },
  { name: 'Water Pump', popular: false, powertrain: 'ice' },
  { name: 'Timing Belt', popular: false, powertrain: 'ice' },
  { name: 'Serpentine Belt', popular: false, powertrain: 'ice' },
  { name: 'Headlight Bulb', popular: false },
  { name: 'Windshield Wipers', popular: true },
  { name: 'Shocks and Struts', popular: false },
  { name: 'CV Axle', popular: false },
  { name: 'Fuel Pump', popular: false, powertrain: 'ice' },
  { name: 'Oxygen Sensor', popular: false, powertrain: 'ice' },
  { name: 'Catalytic Converter', popular: false, powertrain: 'ice' },
  { name: 'Muffler', popular: false, powertrain: 'ice' },
  { name: 'Side Mirror', popular: false },
  { name: 'Outer Tie Rods', popular: false },
  { name: 'Tie Rod Ends', popular: false },
  { name: 'Control Arm', popular: false },
  { name: 'Thermostat', popular: false, powertrain: 'ice' },
  { name: 'Ignition Coil', popular: false, powertrain: 'ice' },
  { name: 'Wheel Bearing', popular: false },
  { name: 'Fuel Injector', popular: false, powertrain: 'ice' },
  { name: 'Mass Air Flow Sensor', popular: false, powertrain: 'ice' },
]

export function partTypesForVehicle(isElectric: boolean): PartType[] {
  return isElectric ? partTypes.filter((p) => p.powertrain !== 'ice') : partTypes
}

export function popularPartTypesForVehicle(isElectric: boolean): PartType[] {
  return partTypesForVehicle(isElectric).filter((p) => p.popular)
}
