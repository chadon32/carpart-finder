import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteAccount } from '../src/api/supabase.ts'

function jsonResponse(body, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) })
}

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

async function exerciseLostDeletionResponse(responseBodyStalls) {
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const timers = new Map()
  const calls = []
  let nextTimerId = 0

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage(),
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: memoryStorage(),
  })
  globalThis.setTimeout = (callback, delay) => {
    const id = ++nextTimerId
    timers.set(id, { callback, delay })
    return id
  }
  globalThis.clearTimeout = (id) => timers.delete(id)
  globalThis.fetch = (url, init) => {
    calls.push({ url: String(url), init })
    if (calls.length === 1) {
      return jsonResponse({ receipt: 'signed-receipt', expiresInMs: 900_000 })
    }
    if (calls.length === 2) {
      assert.equal(init.method, 'DELETE')
      assert.deepEqual(JSON.parse(init.body), {
        confirmation: 'DELETE',
        receipt: 'signed-receipt',
      })
      if (responseBodyStalls) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => new Promise((_resolve, reject) => {
            const rejectAsAborted = () => {
              const error = new Error('Aborted')
              error.name = 'AbortError'
              reject(error)
            }
            if (init.signal.aborted) rejectAsAborted()
            else init.signal.addEventListener('abort', rejectAsAborted)
          }),
        })
      }
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const error = new Error('Aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    }
    assert.equal(calls.length, 3)
    assert.match(String(url), /\/account\/deletion-status$/)
    assert.deepEqual(JSON.parse(init.body), { receipt: 'signed-receipt' })
    return jsonResponse({ success: true, deleted: true })
  }

  try {
    const deletion = deleteAccount()
    for (let i = 0; i < 10 && calls.length < 2; i += 1) await Promise.resolve()
    assert.equal(calls.length, 2)
    assert.match(calls[0].url, /\/account\/deletion-intent$/)
    assert.deepEqual(JSON.parse(calls[0].init.body), { confirmation: 'DELETE' })

    const destructiveTimer = [...timers.values()].find(({ delay }) => delay === 25_000)
    assert.equal(typeof destructiveTimer?.callback, 'function')
    destructiveTimer.callback()

    await assert.doesNotReject(async () => {
      const result = await deletion
      assert.deepEqual(result, { success: true, alreadyDeleted: true })
    })
    assert.equal(calls.length, 3)
    assert.equal(globalThis.localStorage.getItem('cpf-pending-account-deletion'), null)
    assert.equal(globalThis.sessionStorage.getItem('cpf-pending-account-deletion'), null)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
    if (localStorageDescriptor) Object.defineProperty(globalThis, 'localStorage', localStorageDescriptor)
    else delete globalThis.localStorage
    if (sessionStorageDescriptor) Object.defineProperty(globalThis, 'sessionStorage', sessionStorageDescriptor)
    else delete globalThis.sessionStorage
  }
}

test('web deletion reconciles when the destructive request times out', async () => {
  await exerciseLostDeletionResponse(false)
})

test('web deletion reconciles when a successful response body is lost', async () => {
  await exerciseLostDeletionResponse(true)
})
