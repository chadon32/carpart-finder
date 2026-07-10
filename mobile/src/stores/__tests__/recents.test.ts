import { useRecents } from '../recents'

const car = { year: '2015', make: 'Toyota', model: 'Camry', trim: '' }

beforeEach(() => useRecents.setState({ searches: [] }))

test('record dedupes car+part and caps at 8', () => {
  useRecents.getState().record(car, 'Brake Pads')
  useRecents.getState().record(car, 'Brake Pads')
  expect(useRecents.getState().searches).toHaveLength(1)
  for (let i = 0; i < 9; i++) useRecents.getState().record(car, `Part ${i}`)
  expect(useRecents.getState().searches).toHaveLength(8)
  expect(useRecents.getState().searches[0].part).toBe('Part 8')
})
