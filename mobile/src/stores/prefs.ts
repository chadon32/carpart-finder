import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

type PrefsState = {
  zip: string
  setZip: (z: string) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      zip: '',
      setZip: (z) => set({ zip: z.replace(/\D/g, '').slice(0, 5) }),
    }),
    { name: 'cpr-prefs', storage: createJSONStorage(() => AsyncStorage) }
  )
)
