// Production with Supabase unconfigured: the recorder and reader must be
// silent no-ops — never a throw, never a network call.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const { normalizeSignature, recordPriceObservation, getPriceHistory } = await import('./priceHistory.js')

test('normalizeSignature lowercases and trims the searchable fields', () => {
  assert.deepEqual(
    normalizeSignature({ year: ' 2018 ', make: ' Honda', model: 'CIVIC ', part: ' Brake Pads ' }),
    { year: '2018', make: 'honda', model: 'civic', part: 'brake pads' }
  )
})

test('recordPriceObservation is a no-op when accounts are unavailable', async () => {
  const result = await recordPriceObservation({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', total: 42.5 })
  assert.deepEqual(result, { recorded: false })
})

test('recordPriceObservation rejects junk prices without throwing', async () => {
  assert.deepEqual(await recordPriceObservation({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', total: 0 }), { recorded: false })
  assert.deepEqual(await recordPriceObservation({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', total: NaN }), { recorded: false })
})

test('getPriceHistory returns [] when accounts are unavailable', async () => {
  assert.deepEqual(await getPriceHistory({ year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads' }), [])
})
