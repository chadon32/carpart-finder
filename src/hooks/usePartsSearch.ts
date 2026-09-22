import { useCallback, useEffect, useState } from 'react'
import { searchParts, type SearchResponse } from '../api/client'
import type { Car } from '../components/CarSelector'

type CompletedSearch = { key: string; data: SearchResponse | null; error: string | null }

// Owned by the lightweight route, outside the lazy screen's Suspense boundary.
// There is no shared cache or speculative request: each mounted route owns
// exactly one current search, and unmount/identity changes cancel that search.
export function usePartsSearch(car: Car, part: string, zip: string) {
  const [revision, setRevision] = useState(0)
  const [completed, setCompleted] = useState<CompletedSearch | null>(null)
  const effectiveZip = /^\d{5}$/.test(zip) ? zip : ''
  const key = JSON.stringify([car.year, car.make, car.model, car.trim, part, effectiveZip, revision])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    void searchParts(car.year, car.make, car.model, part, car.trim, effectiveZip || undefined, controller.signal)
      .then((data) => {
        if (!cancelled) setCompleted({ key, data, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) setCompleted({
          key,
          data: null,
          error: error instanceof Error ? error.message : 'The search failed. Check your connection and try again.',
        })
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [car.year, car.make, car.model, car.trim, part, effectiveZip, key])

  // Hide an old vehicle/part/ZIP's data on the first changed render, before
  // effects run. The cancellation guard also rejects late, obsolete responses.
  const current = completed?.key === key ? completed : null
  const retry = useCallback(() => setRevision((value) => value + 1), [])
  return { key, data: current?.data ?? null, error: current?.error ?? null, loading: !current, retry }
}

export type PartsSearchState = ReturnType<typeof usePartsSearch>
