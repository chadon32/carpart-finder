import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Listing } from '../api/types'

export type WatchItem = Listing & {
  addedAt: number
  priceAtAdd: number
  carLabel: string
  part: string
}

type WatchlistState = {
  items: WatchItem[]
  watch: (listing: Listing, carLabel: string, part: string) => void
  unwatch: (id: string) => void
  isWatched: (id: string) => boolean
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      watch: (listing, carLabel, part) =>
        set((s) => ({
          items: [
            { ...listing, addedAt: Date.now(), priceAtAdd: listing.price, carLabel, part },
            ...s.items.filter((i) => i.id !== listing.id),
          ],
        })),
      unwatch: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      isWatched: (id) => get().items.some((i) => i.id === id),
    }),
    { name: 'cpr-watchlist', storage: createJSONStorage(() => AsyncStorage) }
  )
)
