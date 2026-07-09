// Bounded parallel map. Preserves input order. Used wherever a user-supplied
// list drives outbound requests, so one HTTP GET cannot fan out into hundreds
// of upstream calls.
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }

  const size = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: size }, worker))
  return results
}
