import type { SearchResponse } from '../api/types'

export type ResultsState = 'loading' | 'error' | 'empty' | 'stale' | 'live'

export function resultsErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : ''
  if (/out of date|update the app/i.test(message)) return message
  return 'The search service could not complete this request. Check your connection and try again.'
}

// Honesty guardrail: stale results must never masquerade as live ones — the
// results screen shows an explicit banner for the 'stale' state. A failed
// REFRESH keeps previous results visible (as 'stale') rather than wiping the
// screen: 'error' is reserved for having nothing at all to show.
export function deriveResultsState(r: SearchResponse | null, error: boolean): ResultsState {
  if (!r) return error ? 'error' : 'loading'
  const hasListings = r.results.length > 0 || (r.fallbackResults?.length ?? 0) > 0
  if (error) return hasListings ? 'stale' : 'error'
  if (!hasListings) return 'empty'
  return r.stale ? 'stale' : 'live'
}
