import { useGarage } from '../garage'

const car = { year: '2015', make: 'Toyota', model: 'Camry', trim: '' }

beforeEach(() => useGarage.setState({ vehicles: [] }))

test('addVehicle prepends and dedupes identical vehicles', () => {
  useGarage.getState().addVehicle(car)
  useGarage.getState().addVehicle({ ...car })
  expect(useGarage.getState().vehicles).toHaveLength(1)
  useGarage.getState().addVehicle({ ...car, year: '2016' })
  expect(useGarage.getState().vehicles[0].year).toBe('2016')
})

test('garage caps at 10 vehicles', () => {
  for (let y = 2000; y < 2012; y++) useGarage.getState().addVehicle({ ...car, year: String(y) })
  expect(useGarage.getState().vehicles).toHaveLength(10)
})

test('removeVehicle removes by index', () => {
  useGarage.getState().addVehicle(car)
  useGarage.getState().removeVehicle(0)
  expect(useGarage.getState().vehicles).toHaveLength(0)
})
