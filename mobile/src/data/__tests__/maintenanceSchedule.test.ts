import { maintenanceForVehicle } from '../maintenanceSchedule'

describe('maintenance schedule safety', () => {
  test('omits engine-specific work until the engine is confirmed', () => {
    expect(maintenanceForVehicle(false).map((item) => item.part)).not.toContain('Timing Belt')
    expect(maintenanceForVehicle(false, true).map((item) => item.part)).toContain('Timing Belt')
  })

  test('omits combustion-only items for electric vehicles', () => {
    const parts = maintenanceForVehicle(true, true).map((item) => item.part)

    expect(parts).not.toContain('Timing Belt')
    expect(parts).not.toContain('Spark Plugs')
    expect(parts).toContain('Windshield Wipers')
  })
})
