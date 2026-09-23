import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyDtc } from '../src/lib/dtcValidation.js'

const knownCodes = { P0302: {}, P0171: {} }

test('recognizes only codes present in the verified code catalog', () => {
  assert.deepEqual(classifyDtc('p0302', knownCodes), { code: 'P0302', status: 'recognized' })
  assert.deepEqual(classifyDtc('P9999', knownCodes), { code: 'P9999', status: 'unknown' })
})

test('separates malformed codes from unknown but well-formed codes', () => {
  assert.equal(classifyDtc('XYZ', knownCodes).status, 'invalid')
  assert.equal(classifyDtc('', knownCodes).status, 'empty')
})
