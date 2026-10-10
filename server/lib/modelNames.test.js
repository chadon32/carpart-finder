import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanModelNames } from './modelNames.js'

// NHTSA lists every registered body builder next to the real models, which
// filled the Model dropdown with trailer makers and motorcycle brands.
test('company names, trailers, and stray punctuation are dropped', () => {
  const cleaned = cleanModelNames([
    "'34",
    'Affordable Aluminum Trailers',
    'Bradford #1',
    'CRANFORD RADIATOR INC.',
    'Eagle Ford Tanks & Trailers LLC',
    'Dominion Motorcycle',
    'GEMINI AUTO & TRAILER INC',
    'Los Lobos Mini Choppers, LLC',
    'Carolina Trikes & Minis',
    'Genesis Trailers Inc.',
    'Camry',
    'F-150',
    'GT',
    'SS',
    'RX',
    'Model 3',
    'CR-V',
    'Transit Connect',
  ])
  assert.deepEqual(cleaned, ['Camry', 'CR-V', 'F-150', 'GT', 'Model 3', 'RX', 'SS', 'Transit Connect'])
})

test('real models that merely contain a business-like word are kept', () => {
  assert.deepEqual(cleanModelNames(['Silverado', 'Express', 'Prius Prime', 'Corvette', 'Ranger']), ['Corvette', 'Express', 'Prius Prime', 'Ranger', 'Silverado'])
})

test('names are trimmed, deduplicated, and sorted', () => {
  assert.deepEqual(cleanModelNames([' Civic', 'Accord', 'Civic ', 'accord', '']), ['Accord', 'Civic'])
})
