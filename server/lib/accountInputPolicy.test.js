import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isUuid,
  normalizeEmail,
  resolveOAuthRedirectOrigin,
  validateAccessToken,
  validateAuthInput,
  validateSavedSearchInput,
  validateTargetPrice,
} from './accountInputPolicy.js'

test('account input policy normalizes email and bounds credentials', () => {
  assert.equal(normalizeEmail(' User@Example.COM '), 'user@example.com')
  assert.equal(normalizeEmail('not-an-email'), null)
  assert.ok(validateAuthInput({ email: 'a@b.com', password: 'short' }, { signup: true }).error)
  assert.ok(validateAuthInput({ email: 'a@b.com', password: 'x'.repeat(129) }).error)
  assert.deepEqual(
    validateAuthInput({ email: ' User@Example.COM ', password: 'password123', name: ' Chadon ' }, { signup: true }).value,
    { email: 'user@example.com', password: 'password123', name: 'Chadon' }
  )
})

test('saved-search and target-price validation rejects abusive values', () => {
  assert.ok(validateSavedSearchInput({ year: 'nope', make: 'Honda', model: 'Civic', part: 'Pads' }).error)
  assert.ok(validateSavedSearchInput({ year: '2020', make: 'A'.repeat(61), model: 'Civic', part: 'Pads' }).error)
  assert.deepEqual(
    validateSavedSearchInput({ year: '2020', make: ' Honda ', model: ' Civic ', trim: '', part: ' Brake Pads ' }).value,
    { year: '2020', make: 'Honda', model: 'Civic', trim: null, part: 'Brake Pads' }
  )
  assert.equal(validateTargetPrice('49.999').value, 50)
  assert.ok(validateTargetPrice(Infinity).error)
  assert.ok(validateTargetPrice(1_000_001).error)
})

test('identifier, token, and OAuth redirect validation fail closed', () => {
  assert.equal(isUuid('0d2ad48b-fd11-4ad7-a185-e53cc9fda0b7'), true)
  assert.equal(isUuid('../../victim'), false)
  assert.equal(validateAccessToken('x'.repeat(8193)), false)
  assert.equal(
    resolveOAuthRedirectOrigin({ NODE_ENV: 'production', FRONTEND_URL: 'javascript:alert(1)' }),
    'https://carpartsradar.com/'
  )
  assert.equal(
    resolveOAuthRedirectOrigin({ NODE_ENV: 'production', FRONTEND_URL: 'https://staging.example.com/path' }),
    'https://staging.example.com/'
  )
})
