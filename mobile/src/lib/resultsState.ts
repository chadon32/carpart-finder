import type { SearchResponse } from '../api/types'

export type ResultsState = 'loading' | 'error' | 'empty' | 'stale' | 'live'

// Honesty guardrail: stale results must never masquerade as live ones — the
// results screen shows an explicit banner for the 'stale' state.
export function deriveResultsState(r: SearchResponse | null, error: boolean): ResultsState {
  if (error) return 'error'
  if (!r) return 'loading'
  if (r.results.length === 0) return 'empty'
  return r.stale ? 'stale' : 'live'
}
