import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT, searchLimit } from './searchLimit.js'

test('callers that do not ask keep the default page size', () => {
  assert.equal(searchLimit(undefined), DEFAULT_SEARCH_LIMIT)
  assert.equal(searchLimit(''), DEFAULT_SEARCH_LIMIT)
  assert.equal(searchLimit('abc'), DEFAULT_SEARCH_LIMIT)
  assert.equal(searchLimit('0'), DEFAULT_SEARCH_LIMIT)
  assert.equal(searchLimit('-5'), DEFAULT_SEARCH_LIMIT)
})

test('a larger page can be requested, up to a fixed ceiling', () => {
  assert.equal(searchLimit('30'), 30)
  assert.equal(searchLimit(30), 30)
  assert.equal(searchLimit('1000'), MAX_SEARCH_LIMIT)
})
