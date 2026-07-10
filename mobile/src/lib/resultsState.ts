import type { SearchResponse } from '../api/types'

export type ResultsState = 'loading' | 'error' | 'empty' | 'stale' | 'live'

// Honesty guardrail: stale results must never masquerade as live ones — the
// results screen shows an explicit banner for the 'stale' state. A failed
// REFRESH keeps previous results visible (as 'stale') rather than wiping the
// screen: 'error' is reserved for having nothing at all to show.
export function deriveResultsState(r: SearchResponse | null, error: boolean): ResultsState {
  if (!r) return error ? 'error' : 'loading'
  if (error) return r.results.length > 0 ? 'stale' : 'error'
  if (r.results.length === 0) return 'empty'
  return r.stale ? 'stale' : 'live'
}
