import { create } from 'zustand'
import type { Listing } from '../api/types'

type CompareState = {
  listings: Listing[]
  toggle: (l: Listing) => void
  clear: () => void
  isComparing: (id: string) => boolean
}

export const useCompare = create<CompareState>()((set, get) => ({
  listings: [],
  toggle: (l) =>
    set((s) => {
      if (s.listings.some((x) => x.id === l.id))
        return { listings: s.listings.filter((x) => x.id !== l.id) }
      if (s.listings.length >= 4) return s
      return { listings: [...s.listings, l] }
    }),
  clear: () => set({ listings: [] }),
  isComparing: (id) => get().listings.some((x) => x.id === id),
}))
