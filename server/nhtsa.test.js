import test from 'node:test'
import assert from 'node:assert/strict'

const realFetch = globalThis.fetch
test.after(() => { globalThis.fetch = realFetch })

function stubVpic(handler) {
  const calls = []
  globalThis.fetch = (url) => {
    const text = String(url)
    calls.push(text)
    const results = handler(text)
    return Promise.resolve(new Response(JSON.stringify({ Results: results.map((name) => ({ Model_Name: name })) }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }
  return calls
}

const { getModels } = await import('./nhtsa.js')

test('models are requested for cars, trucks, and SUVs only, then merged and cleaned', async () => {
  const calls = stubVpic((url) => {
    if (/vehicleType\/car/i.test(url)) return ['Fusion', 'Mustang', "'34"]
    if (/vehicleType\/truck/i.test(url)) return ['F-150', 'Cranford Radiator Inc.']
    if (/vehicleType\/multipurpose/i.test(url)) return ['Explorer', 'Fusion']
    return ['SHOULD NOT BE USED']
  })

  const models = await getModels('Ford', '2017')

  assert.deepEqual(models, ['Explorer', 'F-150', 'Fusion', 'Mustang'])
  assert.equal(calls.length, 3)
  assert.ok(calls.every((url) => /GetModelsForMakeYear\/make\/Ford\/modelyear\/2017\/vehicleType\//.test(url)))
})

test('a make with no typed data falls back to the untyped list, still cleaned', async () => {
  const calls = stubVpic((url) => (/vehicleType\//i.test(url) ? [] : ['Silverado', 'Bradford Trailers LLC']))

  const models = await getModels('Chevrolet', '1985')

  assert.deepEqual(models, ['Silverado'])
  assert.equal(calls.length, 4)
  assert.ok(!/vehicleType\//i.test(calls[3]))
})
