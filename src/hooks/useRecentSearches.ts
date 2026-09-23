import { useEffect, useState } from 'react'
import type { Car } from '../components/CarSelector'
import { isValidPartQuery, normalizePartQuery } from '../lib/searchInput.js'

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
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((entry): entry is RecentSearch => {
        if (!entry || typeof entry !== 'object') return false
        const candidate = entry as Partial<RecentSearch>
        const candidateCar = candidate.car as Partial<Car> | undefined
        return Boolean(
          candidateCar &&
          typeof candidateCar.year === 'string' &&
          typeof candidateCar.make === 'string' &&
          typeof candidateCar.model === 'string' &&
          (candidateCar.trim === undefined || typeof candidateCar.trim === 'string') &&
          candidateCar.year.trim() &&
          candidateCar.make.trim() &&
          candidateCar.model.trim() &&
          isValidPartQuery(candidate.part) &&
          typeof candidate.at === 'number' &&
          Number.isFinite(candidate.at)
        )
      })
      .map((entry) => ({
        ...entry,
        car: { ...entry.car, trim: entry.car.trim || '' },
        part: normalizePartQuery(entry.part),
      }))
      .slice(0, MAX)
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches))
    } catch {
      // Storage can be unavailable in private browsing or when the quota is
      // exhausted. Recent history is optional, so search must keep working.
    }
  }, [searches])

  const record = (car: Car, part: string) => {
    const normalizedPart = normalizePartQuery(part)
    if (!isValidPartQuery(normalizedPart)) return
    setSearches((prev) => {
      const k = keyOf(car, normalizedPart)
      const exists = prev.some((s) => keyOf(s.car, s.part) === k)
      if (exists) return prev
      return [{ car, part: normalizedPart, at: Date.now() }, ...prev].slice(0, MAX)
    })
  }

  const clear = () => setSearches([])
  const remove = (search: RecentSearch) => {
    const key = keyOf(search.car, search.part)
    setSearches((prev) => prev.filter((entry) => keyOf(entry.car, entry.part) !== key))
  }

  return { searches, record, clear, remove }
}
