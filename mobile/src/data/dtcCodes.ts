// OBD-II trouble-code catalog mirrored verbatim from the web app
// (src/components/PartSelector.tsx). Keep in sync manually.

export type DtcEntry = { definition: string; parts: string[]; description: string }

export const COMMON_DTCs: Record<string, DtcEntry> = {
  P0300: {
    definition: 'Random/Multiple Cylinder Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Ignition Wires'],
    description:
      'The engine control module has detected misfires across multiple cylinders. Often resolved by changing spark plugs or coils.',
  },
  P0301: {
    definition: 'Cylinder 1 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire isolated to Cylinder 1. Try replacing spark plugs or swapping coils.',
  },
  P0302: {
    definition: 'Cylinder 2 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire isolated to Cylinder 2. Try replacing spark plugs or swapping coils.',
  },
  P0303: {
    definition: 'Cylinder 3 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire isolated to Cylinder 3. Try replacing spark plugs or swapping coils.',
  },
  P0304: {
    definition: 'Cylinder 4 Misfire Detected',
    parts: ['Spark Plugs', 'Ignition Coils', 'Fuel Injector'],
    description: 'Misfire isolated to Cylinder 4. Try replacing spark plugs or swapping coils.',
  },
  P0171: {
    definition: 'System Too Lean (Bank 1)',
    parts: ['Oxygen Sensor', 'Mass Airflow Sensor', 'Intake Manifold Gasket'],
    description:
      'Too much air or not enough fuel in Bank 1. Commonly caused by vacuum leaks or a dirty/faulty MAF sensor.',
  },
  P0174: {
    definition: 'System Too Lean (Bank 2)',
    parts: ['Oxygen Sensor', 'Mass Airflow Sensor', 'Vacuum Hose'],
    description:
      'Too much air or not enough fuel in Bank 2. Commonly caused by vacuum leaks or a dirty/faulty MAF sensor.',
  },
  P0420: {
    definition: 'Catalyst System Efficiency Below Threshold (Bank 1)',
    parts: ['Catalytic Converter', 'Oxygen Sensor'],
    description:
      'The catalytic converter is not operating at peak efficiency. Can also be triggered by a faulty O2 sensor.',
  },
  P0430: {
    definition: 'Catalyst System Efficiency Below Threshold (Bank 2)',
    parts: ['Catalytic Converter', 'Oxygen Sensor'],
    description:
      'The catalytic converter is not operating at peak efficiency. Can also be triggered by a faulty O2 sensor.',
  },
  P0442: {
    definition: 'EVAP System Leak Detected (Small Leak)',
    parts: ['Gas Cap', 'Vapor Canister Purge Valve', 'EVAP Vent Solenoid'],
    description:
      'Small fuel vapor leak. Most commonly resolved by tightening or replacing a worn gas cap.',
  },
  P0455: {
    definition: 'EVAP System Leak Detected (Large Leak)',
    parts: ['Gas Cap', 'Vapor Canister Purge Valve', 'EVAP Charcoal Canister'],
    description:
      'Large fuel vapor leak. Check for loose gas cap, cracked evap hoses, or purge valve failure.',
  },
  P0115: {
    definition: 'Engine Coolant Temperature Sensor Circuit Malfunction',
    parts: ['Coolant Temperature Sensor', 'Thermostat'],
    description:
      'PCM is not receiving correct engine temperature signals. Can cause cooling fans to run constantly.',
  },
  P0102: {
    definition: 'Mass Air Flow (MAF) Sensor Circuit Low Input',
    parts: ['Mass Airflow Sensor', 'Air Filter'],
    description:
      'MAF sensor signal frequency or voltage is lower than normal limits. Try cleaning or replacing the sensor.',
  },
}

// Exact catalog hit, else the web's generic P-code fallback, else null.
export function lookupDtc(code: string): DtcEntry | null {
  const key = code.trim().toUpperCase()
  if (COMMON_DTCs[key]) return COMMON_DTCs[key]
  if (/^P\d{4}$/.test(key)) {
    return {
      definition: `OBD-II Diagnostic Code ${key}`,
      parts: ['Spark Plugs', 'Ignition Coils', 'Oxygen Sensor', 'Mass Airflow Sensor'],
      description: `Trouble code ${key} entered. Select from the matched replacement components below.`,
    }
  }
  return null
}
