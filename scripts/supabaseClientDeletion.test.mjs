import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, deleteAccount } from '../src/api/supabase.ts'

test('web account deletion aborts a hung request after the client deadline', async () => {
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  let triggerTimeout = null
  let timeoutWasCleared = false

  globalThis.setTimeout = (callback, delay) => {
    assert.equal(delay, 25_000)
    triggerTimeout = callback
    return 1
  }
  globalThis.clearTimeout = (id) => {
    assert.equal(id, 1)
    timeoutWasCleared = true
  }
  globalThis.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      assert.equal(init.method, 'DELETE')
      assert.equal(JSON.parse(init.body).confirmation, 'DELETE')
      init.signal.addEventListener('abort', () => {
        const error = new Error('Aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })

  try {
    const rejection = assert.rejects(deleteAccount(), (error) => {
      assert.equal(error instanceof ApiError, true)
      assert.equal(error.status, 408)
      assert.match(error.message, /timed out/i)
      return true
    })

    assert.equal(typeof triggerTimeout, 'function')
    triggerTimeout()
    await rejection
    assert.equal(timeoutWasCleared, true)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test('web account deletion also times out while a response body is stalled', async () => {
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  let triggerTimeout = null

  globalThis.setTimeout = (callback, delay) => {
    assert.equal(delay, 25_000)
    triggerTimeout = callback
    return 2
  }
  globalThis.clearTimeout = (id) => assert.equal(id, 2)
  globalThis.fetch = (_url, init) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        new Promise((_resolve, reject) => {
          const rejectAsAborted = () => {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
          }
          if (init.signal.aborted) rejectAsAborted()
          else init.signal.addEventListener('abort', rejectAsAborted)
        }),
    })

  try {
    const rejection = assert.rejects(deleteAccount(), (error) => {
      assert.equal(error instanceof ApiError, true)
      assert.equal(error.status, 408)
      return true
    })

    await Promise.resolve()
    await Promise.resolve()
    assert.equal(typeof triggerTimeout, 'function')
    triggerTimeout()
    await rejection
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})
