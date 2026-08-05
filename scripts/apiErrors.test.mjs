import test from 'node:test'
import assert from 'node:assert/strict'
import { friendlyApiError, readJsonResponse } from '../src/lib/apiErrors.js'

test('turns an HTML or malformed API response into safe user-facing copy', () => {
  assert.equal(
    friendlyApiError('/api/search?part=brake+pads', 200, { parseFailed: true }),
    "We couldn't load prices right now. Check your connection and try again."
  )
})

test('keeps auth and rate-limit failures actionable', () => {
  assert.equal(friendlyApiError('/api/supabase/login', 401), 'Your session has expired. Please sign in again and retry.')
  assert.equal(friendlyApiError('/api/search', 429), 'Too many requests right now. Please wait a moment and try again.')
})

test('readJsonResponse preserves server errors and hides malformed response bodies', async () => {
  await assert.rejects(
    () => readJsonResponse(new Response('<!DOCTYPE html>', { status: 502 }), '/api/search'),
    /couldn't load prices right now/i
  )
  await assert.rejects(
    () => readJsonResponse(new Response(JSON.stringify({ error: 'Account already exists' }), { status: 409 }), '/api/supabase/signup'),
    /Account already exists/
  )
  await assert.rejects(
    () => readJsonResponse(new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403 }), '/api/identify-part'),
    /official site/i
  )
})
