// NHTSA's model lists include every registered manufacturer next to the real
// models: trailer builders, body shops, motorcycle brands. Asking for cars,
// trucks, and SUVs removes most of them; this removes what is left.

const NOT_A_MODEL = [
  /^[^a-z0-9]/i, // "'34", "#1" — starts with punctuation
  /#/, // "Bradford #1"
  /\b(?:inc|llc|ltd|corp|co|company|gmbh)\b\.?/i,
  /,/, // "Los Lobos Mini Choppers, LLC"
  /\b(?:trailers?|motorcycles?|choppers?|trikes?|radiators?|tanks|aluminum|fabricat\w*|manufactur\w*|industries|enterprises|coachworks|bodies|customs?)\b/i,
]

export function isRealModelName(name) {
  const text = String(name ?? '').trim()
  if (!text) return false
  return !NOT_A_MODEL.some((pattern) => pattern.test(text))
}

export function cleanModelNames(names) {
  const seen = new Map()
  for (const name of names ?? []) {
    const text = String(name ?? '').trim().replace(/\s+/g, ' ')
    if (!isRealModelName(text)) continue
    const key = text.toLowerCase()
    if (!seen.has(key)) seen.set(key, text)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
