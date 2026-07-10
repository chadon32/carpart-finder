import { useWatchlist } from '../watchlist'
import type { Listing } from '../../api/types'

const listing = { id: 'l1', title: 'Pads', price: 20 } as Listing

beforeEach(() => useWatchlist.setState({ items: [] }))

test('watch stores price at add time and dedupes by id', () => {
  useWatchlist.getState().watch(listing, '2015 Toyota Camry', 'Brake Pads')
  useWatchlist.getState().watch(listing, '2015 Toyota Camry', 'Brake Pads')
  const items = useWatchlist.getState().items
  expect(items).toHaveLength(1)
  expect(items[0].priceAtAdd).toBe(20)
  expect(items[0].part).toBe('Brake Pads')
})

test('unwatch removes by listing id, isWatched reflects state', () => {
  useWatchlist.getState().watch(listing, 'car', 'part')
  expect(useWatchlist.getState().isWatched('l1')).toBe(true)
  useWatchlist.getState().unwatch('l1')
  expect(useWatchlist.getState().isWatched('l1')).toBe(false)
})
