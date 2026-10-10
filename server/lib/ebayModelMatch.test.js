import test from 'node:test'
import assert from 'node:assert/strict'
import { matchEbayModels } from './ebayModelMatch.js'

// NHTSA and eBay name the same vehicle differently. The government list says
// "RX"; eBay says "RX350" and "RX450h". A search that sends NHTSA's spelling
// returns no confirmed matches, so the model is translated first. These lists
// are real eBay values for the years shown.
test('a spelling or capitalization difference maps to the one eBay value', () => {
  assert.deepEqual(matchEbayModels('F-PACE', ['E-Pace', 'F-Pace', 'I-Pace']), { models: ['F-Pace'], exact: true })
  assert.deepEqual(matchEbayModels('civic', ['Accord', 'Civic']), { models: ['Civic'], exact: true })
})

test('an exact match never pulls in longer names', () => {
  assert.deepEqual(matchEbayModels('Camry', ['Camry', 'Camry Solara']), { models: ['Camry'], exact: true })
  assert.deepEqual(matchEbayModels('X5', ['X5', 'X5 M']), { models: ['X5'], exact: true })
})

test('a model family expands to the variants eBay lists', () => {
  assert.deepEqual(
    matchEbayModels('RX', ['ES300h', 'ES350', 'NX200t', 'RX350', 'RX350L', 'RX450h', 'RX450hL']),
    { models: ['RX350', 'RX350L', 'RX450h', 'RX450hL'], exact: false },
  )
  assert.deepEqual(
    matchEbayModels('Silverado', ['Camaro', 'Silverado 1500', 'Silverado 1500 HD', 'Silverado 2500 HD']),
    { models: ['Silverado 1500', 'Silverado 1500 HD', 'Silverado 2500 HD'], exact: false },
  )
})

test('"-Class" and "-Series" names map to their numbered variants', () => {
  assert.deepEqual(
    matchEbayModels('C-Class', ['A220', 'C180', 'C300', 'C43 AMG', 'CLA200', 'CLS450']),
    { models: ['C180', 'C300', 'C43 AMG'], exact: false },
  )
  assert.deepEqual(matchEbayModels('3-Series', ['328i', '330i', 'M3', 'X3']), { models: ['328i', '330i'], exact: false })
})

test('a more specific NHTSA name maps to the shorter eBay model', () => {
  assert.deepEqual(
    matchEbayModels('Cooper Convertible', ['Cooper', 'Cooper Clubman', 'Cooper Countryman']),
    { models: ['Cooper'], exact: false },
  )
})

test('a different model that only shares letters is not a match', () => {
  assert.deepEqual(matchEbayModels('ES', ['ESCALADE', 'ES300h']), { models: ['ES300h'], exact: false })
  assert.deepEqual(matchEbayModels('Transit', ['Transit 150', 'Transit Connect']), { models: ['Transit 150'], exact: false })
  assert.deepEqual(matchEbayModels('Model 3', ['Model S', 'Model X', 'Model Y']), { models: [], exact: false })
})

test('no eBay data means no translation', () => {
  assert.deepEqual(matchEbayModels('Accord', []), { models: [], exact: false })
  assert.deepEqual(matchEbayModels('', ['Civic']), { models: [], exact: false })
  assert.deepEqual(matchEbayModels('Civic', undefined), { models: [], exact: false })
})

test('a large family is capped so one search stays a handful of requests', () => {
  const many = ['1500', '1500 HD', '1500 LD', '2500', '2500 HD', '3500', '3500 HD'].map((x) => `Silverado ${x}`)
  const { models } = matchEbayModels('Silverado', many, { max: 5 })
  assert.deepEqual(models, many.slice(0, 5))
})
