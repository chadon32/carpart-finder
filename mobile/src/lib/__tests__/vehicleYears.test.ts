import { vehicleYears } from '../vehicleYears'

test('vehicle years include the next model year through 1980', () => {
  const years = vehicleYears(2026)
  expect(years[0]).toBe('2027')
  expect(years.at(-1)).toBe('1980')
  expect(years).toHaveLength(48)
})
