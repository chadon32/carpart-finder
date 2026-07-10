import { useCompare } from '../compare'
import type { Listing } from '../../api/types'

const l = (id: string) => ({ id } as Listing)

beforeEach(() => useCompare.setState({ listings: [] }))

test('toggle adds then removes', () => {
  useCompare.getState().toggle(l('a'))
  expect(useCompare.getState().isComparing('a')).toBe(true)
  useCompare.getState().toggle(l('a'))
  expect(useCompare.getState().isComparing('a')).toBe(false)
})

test('caps at 4 listings', () => {
  for (const id of ['a', 'b', 'c', 'd', 'e']) useCompare.getState().toggle(l(id))
  expect(useCompare.getState().listings).toHaveLength(4)
  expect(useCompare.getState().isComparing('e')).toBe(false)
})

test('clear empties', () => {
  useCompare.getState().toggle(l('a'))
  useCompare.getState().clear()
  expect(useCompare.getState().listings).toHaveLength(0)
})
