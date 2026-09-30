import { Box, Cog, Disc, Thermometer, Wrench, Zap, type LucideIcon } from 'lucide-react'

export type MaintenanceKit = {
  title: string
  search: string
  description: string
  components: string[]
  icon: LucideIcon
  requiresEngineConfirmation?: boolean
  iceOnly?: boolean
}

export const maintenanceKits: MaintenanceKit[] = [
  {
    title: 'Complete Brake Job',
    search: 'Brake Pad and Rotor Kit',
    description: 'Looks for a combined pad-and-rotor kit.',
    components: ['Front Brake Pads', 'Rear Brake Pads', 'Brake Rotors'],
    icon: Disc,
  },
  {
    title: 'Engine Tune-Up',
    search: 'Ignition Coil Spark Plug Kit',
    description: 'Looks for spark plugs, ignition coils, and boots sold together.',
    components: ['Spark Plugs', 'Ignition Coils', 'Ignition Coil Boots'],
    icon: Zap,
    iceOnly: true,
  },
  {
    title: 'Timing Service',
    search: 'Timing Belt Water Pump Kit',
    description: 'Looks for a timing belt and water-pump service kit.',
    components: ['Timing Belt Kit', 'Water Pump', 'Belt Tensioner'],
    icon: Cog,
    requiresEngineConfirmation: true,
    iceOnly: true,
  },
  {
    title: 'Front Suspension Rebuild',
    search: 'Control Arm Suspension Kit',
    description: 'Looks for a combined front-suspension component kit.',
    components: ['Control Arms', 'Ball Joints', 'Tie Rod Ends'],
    icon: Wrench,
  },
  {
    title: 'Cooling System Refresh',
    search: 'Radiator Hose Thermostat Kit',
    description: 'Looks for cooling-system components sold as one kit.',
    components: ['Radiator', 'Radiator Hoses', 'Thermostat'],
    icon: Thermometer,
  },
  {
    title: 'Full Filter Service',
    search: 'Air Cabin Filter Kit',
    description: 'Looks for engine and cabin air filters sold together.',
    components: ['Engine Air Filter', 'Cabin Air Filter'],
    icon: Box,
  },
]

export function maintenanceKitForSearch(search: string): MaintenanceKit | null {
  const normalized = search.trim().toLowerCase()
  return maintenanceKits.find((kit) => kit.search.toLowerCase() === normalized) ?? null
}

export function maintenanceKitsForVehicle(isElectric: boolean): MaintenanceKit[] {
  return maintenanceKits.filter((kit) => {
    if (kit.requiresEngineConfirmation) return false
    if (isElectric && kit.iceOnly) return false
    return true
  })
}
