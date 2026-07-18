import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

type PrefsState = {
  zip: string
  // True once AsyncStorage rehydration has run — consumers that trigger
  // network work on `zip` wait for this to avoid a double fetch on launch.
  hydrated: boolean
  setZip: (z: string) => void
  reset: () => void
  setHydrated: () => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      zip: '',
      hydrated: false,
      setZip: (z) => set({ zip: z.replace(/\D/g, '').slice(0, 5) }),
      reset: () => set({ zip: '' }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'cpr-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ zip: s.zip }),
      onRehydrateStorage: () => () => {
        usePrefs.getState().setHydrated()
      },
    }
  )
)
