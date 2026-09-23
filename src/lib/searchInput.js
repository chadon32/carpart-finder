export const MAX_PART_QUERY_LENGTH = 60

export function normalizePartQuery(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function isValidPartQuery(value) {
  const normalized = normalizePartQuery(value)
  return normalized.length > 0 && normalized.length <= MAX_PART_QUERY_LENGTH
}
