import test from 'node:test'
import assert from 'node:assert/strict'
import { getAuthToken } from './auth.js'

test('reads the token from the cpf_token cookie', () => {
  assert.equal(getAuthToken({ headers: { cookie: 'a=1; cpf_token=abc123; b=2' } }), 'abc123')
})

test('url-decodes the cookie value', () => {
  assert.equal(getAuthToken({ headers: { cookie: 'cpf_token=a%20b' } }), 'a b')
})

test('returns null on malformed percent-encoding rather than throwing', () => {
  assert.equal(getAuthToken({ headers: { cookie: 'cpf_token=%E0%A4%A' } }), null)
})

test('reads a well-formed Bearer header', () => {
  assert.equal(getAuthToken({ headers: { authorization: 'Bearer abc123' } }), 'abc123')
})

test('accepts a case-insensitive scheme', () => {
  assert.equal(getAuthToken({ headers: { authorization: 'bearer abc123' } }), 'abc123')
})

test('rejects a bare token with no scheme', () => {
  assert.equal(getAuthToken({ headers: { authorization: 'abc123' } }), null)
})

test('rejects a non-Bearer scheme', () => {
  assert.equal(getAuthToken({ headers: { authorization: 'Basic abc123' } }), null)
})

test('does not mangle a token containing the word Bearer', () => {
  assert.equal(getAuthToken({ headers: { authorization: 'Bearer xBearerx' } }), 'xBearerx')
})

test('returns null with no credentials', () => {
  assert.equal(getAuthToken({ headers: {} }), null)
})

test('prefers the cookie over the header', () => {
  assert.equal(
    getAuthToken({ headers: { cookie: 'cpf_token=fromCookie', authorization: 'Bearer fromHeader' } }),
    'fromCookie'
  )
})
