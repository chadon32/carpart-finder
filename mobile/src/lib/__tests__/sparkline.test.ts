import { sparklineHeights } from '../sparkline'

test('normalizes to 0..1 with min at 0 and max at 1', () =>
  expect(sparklineHeights([10, 20, 15])).toEqual([0, 1, 0.5]))

test('flat series renders mid-height', () =>
  expect(sparklineHeights([12, 12])).toEqual([0.5, 0.5]))

test('empty series stays empty', () => expect(sparklineHeights([])).toEqual([]))
