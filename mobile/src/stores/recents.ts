import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Car } from '../api/types'

export type RecentSearch = { car: Car; part: string; at: number }

type RecentsState = {
  searches: RecentSearch[]
  record: (car: Car, part: string) => void
  clear: () => void
}

const sameSearch = (a: RecentSearch, car: Car, part: string) =>
  a.part === part &&
  a.car.year === car.year &&
  a.car.make === car.make &&
  a.car.model === car.model &&
  a.car.trim === car.trim

export const useRecents = create<RecentsState>()(
  persist(
    (set) => ({
      searches: [],
      record: (car, part) =>
        set((s) => ({
          searches: [
            { car, part, at: Date.now() },
            ...s.searches.filter((x) => !sameSearch(x, car, part)),
          ].slice(0, 8),
        })),
      clear: () => set({ searches: [] }),
    }),
    { name: 'cpr-recents', storage: createJSONStorage(() => AsyncStorage) }
  )
)
