import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeMake } from '../shared/vehicleMake.js'

test('title-cases the upper-case makes NHTSA returns', () => {
  const cases = [
    ['HONDA', 'Honda'],
    ['TOYOTA', 'Toyota'],
    ['MERCEDES-BENZ', 'Mercedes-Benz'],
    ['LAND ROVER', 'Land Rover'],
    ['ALFA ROMEO', 'Alfa Romeo'],
    ['ROLLS-ROYCE', 'Rolls-Royce'],
  ]
  for (const [input, expected] of cases) assert.equal(normalizeMake(input), expected)
})

test('uses eBay spelling where title case would be wrong', () => {
  const cases = [
    ['BMW', 'BMW'],
    ['GMC', 'GMC'],
    ['INFINITI', 'INFINITI'],
    ['MCLAREN', 'McLaren'],
    ['DELOREAN', 'DeLorean'],
    ['VINFAST', 'VinFast'],
    ['WHITEGMC', 'White/GMC'],
    ['AM GENERAL', 'AM General'],
  ]
  for (const [input, expected] of cases) assert.equal(normalizeMake(input), expected)
})

test('short brand words are title-cased but unknown short names stay acronyms', () => {
  assert.equal(normalizeMake('KIA'), 'Kia')
  assert.equal(normalizeMake('RAM'), 'Ram')
  assert.equal(normalizeMake('GEO'), 'Geo')
  for (const acronym of ['MG', 'RPM', 'FF', 'XOS']) assert.equal(normalizeMake(acronym), acronym)
})

test('leaves names with punctuation or digits exactly as given', () => {
  for (const odd of ['S.T.I', 'TH!NK', 'JAC 427', 'ACELA, INC', 'CONTEMPORARY CLASSIC CARS (CCC)']) {
    assert.equal(normalizeMake(odd), odd)
  }
})

test('is idempotent, so already-normalized and legacy values converge', () => {
  for (const make of ['HONDA', 'Honda', 'MERCEDES-BENZ', 'BMW', 'INFINITI', 'KIA', 'MG', 'S.T.I', 'LAND ROVER']) {
    assert.equal(normalizeMake(normalizeMake(make)), normalizeMake(make))
  }
})

test('tolerates missing values and stray whitespace', () => {
  assert.equal(normalizeMake(undefined), '')
  assert.equal(normalizeMake(null), '')
  assert.equal(normalizeMake('   '), '')
  assert.equal(normalizeMake('  honda  '), 'Honda')
  assert.equal(normalizeMake('land   rover'), 'Land Rover')
})
