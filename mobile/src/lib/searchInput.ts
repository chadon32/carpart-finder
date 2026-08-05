// Keep native search input within the API's documented 60-character bound.
// Normalizing whitespace here also prevents a pasted query from producing a
// visually empty search or a confusing server-side validation error.
export const MAX_PART_QUERY_LENGTH = 60

export function normalizePartQuery(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function isValidPartQuery(value: string) {
  const normalized = normalizePartQuery(value)
  return normalized.length > 0 && normalized.length <= MAX_PART_QUERY_LENGTH
}
