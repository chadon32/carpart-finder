import test from 'node:test'
import assert from 'node:assert/strict'
import { makeAccountsGate } from './accountsAvailable.js'

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

test('calls next() when accounts are available', () => {
  const res = fakeRes()
  let called = false
  makeAccountsGate(true)({}, res, () => { called = true })
  assert.equal(called, true)
  assert.equal(res.statusCode, null)
})

test('returns 503 and does not call next() when unavailable', () => {
  const res = fakeRes()
  let called = false
  makeAccountsGate(false)({}, res, () => { called = true })
  assert.equal(called, false)
  assert.equal(res.statusCode, 503)
  assert.equal(res.body.error, 'Accounts are temporarily unavailable.')
})

test('the 503 body leaks no configuration detail', () => {
  const res = fakeRes()
  makeAccountsGate(false)({}, res, () => {})
  const serialized = JSON.stringify(res.body).toLowerCase()
  assert.ok(!serialized.includes('supabase'))
  assert.ok(!serialized.includes('env'))
  assert.ok(!serialized.includes('key'))
})
