import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_PART_QUERY_LENGTH,
  isValidPartQuery,
  normalizePartQuery,
} from '../src/lib/searchInput.js'

test('normalizes whitespace without changing meaningful part text', () => {
  assert.equal(normalizePartQuery('  Front   Brake\tPads  '), 'Front Brake Pads')
})

test('rejects empty and over-long part searches at the server-aligned limit', () => {
  assert.equal(isValidPartQuery('   '), false)
  assert.equal(isValidPartQuery('x'.repeat(MAX_PART_QUERY_LENGTH)), true)
  assert.equal(isValidPartQuery('x'.repeat(MAX_PART_QUERY_LENGTH + 1)), false)
})
