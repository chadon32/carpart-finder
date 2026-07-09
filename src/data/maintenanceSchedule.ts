import { partTypes } from './partTypes'

export type MaintenanceItem = {
  // Must match a partTypes name — "Shop" runs a normal part search.
  part: string
  intervalMiles: number
  note: string
}

// Broad industry rules of thumb, NOT vehicle-specific schedules. The UI must
// always label these "typical" and point at the owner's manual. There is
// deliberately no due-date math: without real service history, "due now"
// would be fabricated precision.
export const maintenanceSchedule: MaintenanceItem[] = [
  { part: 'Oil Filter', intervalMiles: 5000, note: 'Replaced at every oil change' },
  { part: 'Windshield Wipers', intervalMiles: 12000, note: 'Or about once a year' },
  { part: 'Cabin Air Filter', intervalMiles: 15000, note: 'Keeps HVAC airflow strong' },
  { part: 'Air Filter', intervalMiles: 15000, note: 'Sooner on dusty roads' },
  { part: 'Brake Pads', intervalMiles: 40000, note: '30k–70k depending on driving' },
  { part: 'Battery', intervalMiles: 50000, note: 'Typically lasts 3–5 years' },
  { part: 'Brake Rotors', intervalMiles: 60000, note: 'Often replaced with pads' },
  { part: 'Spark Plugs', intervalMiles: 60000, note: '30k copper; up to 100k iridium' },
  { part: 'Coolant', intervalMiles: 60000, note: 'Flush per the manual spec' },
  { part: 'Transmission Fluid', intervalMiles: 60000, note: 'If serviceable — check the manual' },
  { part: 'Serpentine Belt', intervalMiles: 75000, note: 'Sooner if cracked or squealing' },
  { part: 'Timing Belt', intervalMiles: 90000, note: 'Critical on interference engines' },
]

// EVs skip combustion-only items but keep the rest (12V battery, wipers,
// brakes, cabin filter all still wear).
export function maintenanceForVehicle(isElectric: boolean): MaintenanceItem[] {
  if (!isElectric) return maintenanceSchedule
  const iceOnly = new Set(partTypes.filter((p) => p.powertrain === 'ice').map((p) => p.name))
  return maintenanceSchedule.filter((m) => !iceOnly.has(m.part))
}
