import { Box, Cog, Disc, Thermometer, Wrench, Zap, type LucideIcon } from 'lucide-react'

export type MaintenanceKit = {
  title: string
  search: string
  description: string
  components: string[]
  icon: LucideIcon
  color: string
  background: string
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
    color: 'text-blue-600',
    background: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    title: 'Engine Tune-Up',
    search: 'Ignition Coil Spark Plug Kit',
    description: 'Looks for spark plugs, ignition coils, and boots sold together.',
    components: ['Spark Plugs', 'Ignition Coils', 'Ignition Coil Boots'],
    icon: Zap,
    color: 'text-amber-600',
    background: 'bg-amber-50 dark:bg-amber-900/20',
    iceOnly: true,
  },
  {
    title: 'Timing Service',
    search: 'Timing Belt Water Pump Kit',
    description: 'Looks for a timing belt and water-pump service kit.',
    components: ['Timing Belt Kit', 'Water Pump', 'Belt Tensioner'],
    icon: Cog,
    color: 'text-brand-600',
    background: 'bg-brand-50 dark:bg-brand-900/20',
    requiresEngineConfirmation: true,
    iceOnly: true,
  },
  {
    title: 'Front Suspension Rebuild',
    search: 'Control Arm Suspension Kit',
    description: 'Looks for a combined front-suspension component kit.',
    components: ['Control Arms', 'Ball Joints', 'Tie Rod Ends'],
    icon: Wrench,
    color: 'text-purple-600',
    background: 'bg-purple-50 dark:bg-purple-900/20',
  },
  {
    title: 'Cooling System Refresh',
    search: 'Radiator Hose Thermostat Kit',
    description: 'Looks for cooling-system components sold as one kit.',
    components: ['Radiator', 'Radiator Hoses', 'Thermostat'],
    icon: Thermometer,
    color: 'text-emerald-600',
    background: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    title: 'Full Filter Service',
    search: 'Air Cabin Filter Kit',
    description: 'Looks for engine and cabin air filters sold together.',
    components: ['Engine Air Filter', 'Cabin Air Filter'],
    icon: Box,
    color: 'text-slate-600',
    background: 'bg-slate-50 dark:bg-slate-800',
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
