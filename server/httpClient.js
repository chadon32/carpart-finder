// Shared outbound-HTTP helper: every upstream call (eBay, NHTSA, Wikipedia)
// gets a hard timeout so a hung connection can't stall a whole request, plus
// automatic retry with backoff on transient failures (429/5xx/network drops).
// 4xx errors other than 429 are NOT retried — they mean the request itself is
// wrong and retrying would just burn quota.

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithRetry(url, options = {}, { timeoutMs = 8000, retries = 2, backoffMs = 300 } = {}) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })

      if (res.ok || !RETRYABLE_STATUSES.has(res.status)) {
        return res
      }

      // Transient upstream failure. Honor Retry-After when the server sends
      // one (rate limits), otherwise back off exponentially: 300ms, 900ms, ...
      lastError = new Error(`Upstream returned ${res.status} for ${new URL(url).hostname}`)
      if (attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after'))
        const waitMs = retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : backoffMs * 3 ** attempt
        await sleep(waitMs)
      }
    } catch (err) {
      // AbortError (timeout) or network failure — both worth retrying.
      lastError = err.name === 'TimeoutError' ? new Error(`Request to ${new URL(url).hostname} timed out`) : err
      if (attempt < retries) {
        await sleep(backoffMs * 3 ** attempt)
      }
    }
  }

  throw lastError
}
