import type { Recall } from '../api/client'

// Session-scoped recall cache: the garage badge only shows a count that was
// actually fetched this session — never a placeholder or a guess.
const cacheKey = (year: string, make: string, model: string) =>
  `cpf-recalls-${year}|${make}|${model}`.toLowerCase()

export function readCachedRecalls(year: string, make: string, model: string): Recall[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(year, make, model))
    return raw ? (JSON.parse(raw) as Recall[]) : null
  } catch {
    return null
  }
}

export function writeCachedRecalls(year: string, make: string, model: string, recalls: Recall[]) {
  try {
    sessionStorage.setItem(cacheKey(year, make, model), JSON.stringify(recalls))
  } catch {
    // Session cache is a bonus; storage may be full or blocked.
  }
}

export function cachedRecallCount(year: string, make: string, model: string): number | null {
  const recalls = readCachedRecalls(year, make, model)
  return recalls ? recalls.length : null
}
