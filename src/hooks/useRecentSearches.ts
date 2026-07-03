import { useEffect, useState } from 'react'
import type { Car } from '../components/CarSelector'

export type RecentSearch = {
  car: Car
  part: string
  at: number
}

const STORAGE_KEY = 'car-part-finder-recent'
const MAX = 6

function load(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function keyOf(car: Car, part: string) {
  return `${car.year}|${car.make}|${car.model}|${car.trim}|${part}`.toLowerCase()
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>(() => load())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches))
  }, [searches])

  const record = (car: Car, part: string) => {
    setSearches((prev) => {
      const k = keyOf(car, part)
      const deduped = prev.filter((s) => keyOf(s.car, s.part) !== k)
      return [{ car, part, at: Date.now() }, ...deduped].slice(0, MAX)
    })
  }

  const clear = () => setSearches([])

  return { searches, record, clear }
}
