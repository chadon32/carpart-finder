// eBay's compatibility data names models differently from NHTSA, and its
// Browse search only counts a match when the model is spelled exactly its way.

const words = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// "C-Class" and "3-Series" are NHTSA's names for what eBay lists as C300, 328i.
const stripFamilySuffix = (name) => name.replace(/ (?:class|series)$/, '')

export const DEFAULT_MAX_VARIANTS = 5

// Returns the eBay model values that correspond to an NHTSA model name.
// `exact` is true when eBay lists the model under the same name (ignoring
// case and punctuation); otherwise the models are a family (RX -> RX350,
// RX450h) or a shorter eBay name (Cooper Convertible -> Cooper).
export function matchEbayModels(model, ebayModels, { max = DEFAULT_MAX_VARIANTS } = {}) {
  const wanted = words(model)
  const available = (Array.isArray(ebayModels) ? ebayModels : [])
    .map((value) => ({ value, key: words(value) }))
    .filter((entry) => entry.key)
  if (!wanted || available.length === 0) return { models: [], exact: false }

  const exact = available.filter((entry) => entry.key === wanted)
  if (exact.length > 0) return { models: exact.slice(0, max).map((entry) => entry.value), exact: true }

  // A family member continues the name with a number: RX -> RX350, RX 450h;
  // Silverado -> Silverado 1500. A name that continues with letters (ES ->
  // ESCALADE, Transit -> Transit Connect) is a different model.
  const base = stripFamilySuffix(wanted)
  const family = available.filter((entry) => entry.key.startsWith(base) && /^ ?\d/.test(entry.key.slice(base.length)))
  if (family.length > 0) return { models: family.slice(0, max).map((entry) => entry.value), exact: false }

  // NHTSA is the more specific name: "Cooper Convertible" -> eBay's "Cooper".
  const shorter = available
    .filter((entry) => entry.key.length >= 3 && wanted.startsWith(`${entry.key} `))
    .sort((a, b) => b.key.length - a.key.length)
  if (shorter.length > 0) return { models: [shorter[0].value], exact: false }

  return { models: [], exact: false }
}
