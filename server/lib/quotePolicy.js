const STOPWORDS = new Set(['and', 'the', 'of', 'for', 'with', 'kit', 'set'])
const ACCESSORY_WORDS = [
  'screw', 'bolt', 'clip', 'pin', 'washer', 'retainer', 'grommet', 'bracket',
  'decal', 'sticker', 'emblem', 'shim', 'grease', 'cleaner', 'paint', 'tool',
  'gauge', 'sensor', 'switch', 'connector', 'wire', 'harness', 'relay', 'fuse', 'cap',
  'cover', 'universal', 'pedal', 'defect', 'damaged', 'broken', 'cracked',
]

export function pickVerifiedListingForPart(results, part) {
  const verifiedResults = results.filter((result) => result.verifiedFitment === true)
  if (verifiedResults.length === 0) return null

  const partTokens = part
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .map((token) => token.replace(/s$/, ''))

  if (partTokens.length === 0) return null

  const base = partTokens.length >= 3 ? partTokens.length - 1 : partTokens.length
  const required = Math.min(base, 4)
  const blocked = ACCESSORY_WORDS.filter(
    (word) => !partTokens.some((token) => token.startsWith(word) || word.startsWith(token))
  )

  const candidates = verifiedResults.filter((result) => {
    if (/parts only|not working/i.test(result.condition || '')) return false
    const titleTokens = result.title.toLowerCase().split(/[^a-z0-9]+/).map((token) => token.replace(/s$/, ''))
    const hits = partTokens.filter((partToken) =>
      titleTokens.some((titleToken) => titleToken.startsWith(partToken))
    ).length
    return hits >= required && !titleTokens.some((titleToken) => blocked.includes(titleToken))
  })

  if (candidates.length === 0) return null
  return candidates.reduce((best, result) => {
    const total = result.price + (result.shippingCost || 0)
    return total < best.total ? { total, listing: result } : best
  }, { total: Infinity, listing: null }).listing
}
