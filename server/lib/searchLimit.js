export const DEFAULT_SEARCH_LIMIT = 15
export const MAX_SEARCH_LIMIT = 40

// How many listings one search may return. Callers that do not ask (the iOS
// app, older pages) keep the default; asking for more is capped so a single
// request cannot pull an unbounded page from the marketplace.
export function searchLimit(value) {
  const requested = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isInteger(requested) || requested < 1) return DEFAULT_SEARCH_LIMIT
  return Math.min(requested, MAX_SEARCH_LIMIT)
}
