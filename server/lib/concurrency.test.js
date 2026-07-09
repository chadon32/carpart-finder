import test from 'node:test'
import assert from 'node:assert/strict'
import { mapWithConcurrency } from './concurrency.js'

test('preserves input order', async () => {
  const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10)
  assert.deepEqual(out, [10, 20, 30, 40])
})

test('preserves order even when later items resolve first', async () => {
  const out = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
    await new Promise((r) => setTimeout(r, ms))
    return ms
  })
  assert.deepEqual(out, [30, 10, 20])
})

test('never exceeds the concurrency limit', async () => {
  let active = 0
  let peak = 0
  await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
    active++
    peak = Math.max(peak, active)
    await new Promise((r) => setTimeout(r, 5))
    active--
  })
  assert.ok(peak <= 3, `peak concurrency was ${peak}`)
})

test('handles an empty list', async () => {
  assert.deepEqual(await mapWithConcurrency([], 5, async (x) => x), [])
})

test('handles a limit larger than the list', async () => {
  assert.deepEqual(await mapWithConcurrency([1, 2], 99, async (n) => n), [1, 2])
})

test('passes the index to the callback', async () => {
  const out = await mapWithConcurrency(['a', 'b'], 1, async (v, i) => `${i}:${v}`)
  assert.deepEqual(out, ['0:a', '1:b'])
})
