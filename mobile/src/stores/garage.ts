import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { GarageVehicle } from '../api/types'

type GarageState = {
  vehicles: GarageVehicle[]
  addVehicle: (v: GarageVehicle) => void
  removeVehicle: (index: number) => void
  clear: () => void
}

const sameCar = (a: GarageVehicle, b: GarageVehicle) =>
  a.year === b.year && a.make === b.make && a.model === b.model && a.trim === b.trim

export const useGarage = create<GarageState>()(
  persist(
    (set) => ({
      vehicles: [],
      addVehicle: (v) =>
        set((s) => ({
          vehicles: [v, ...s.vehicles.filter((x) => !sameCar(x, v))].slice(0, 10),
        })),
      removeVehicle: (index) =>
        set((s) => ({ vehicles: s.vehicles.filter((_, i) => i !== index) })),
      clear: () => set({ vehicles: [] }),
    }),
    { name: 'cpr-garage', storage: createJSONStorage(() => AsyncStorage) }
  )
)
