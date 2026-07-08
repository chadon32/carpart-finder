import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAuthConfig } from './config.js'

const REAL = {
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
}

test('production with full config: accounts available, never mock', () => {
  const c = resolveAuthConfig({ ...REAL, NODE_ENV: 'production' })
  assert.equal(c.accountsAvailable, true)
  assert.equal(c.isMockMode, false)
})

// THE CRITICAL CASE. Before this fix, an unconfigured production deploy
// silently entered mock mode, where any password authenticated any email.
test('production with NO supabase config: accounts unavailable, never mock', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'production' })
  assert.equal(c.isMockMode, false)
  assert.equal(c.accountsAvailable, false)
})

test('production with ALLOW_MOCK_AUTH=1 still refuses mock mode', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'production', ALLOW_MOCK_AUTH: '1' })
  assert.equal(c.isMockMode, false)
  assert.equal(c.accountsAvailable, false)
})

test('production missing ONLY the service-role key: accounts unavailable', () => {
  const c = resolveAuthConfig({
    NODE_ENV: 'production',
    SUPABASE_URL: REAL.SUPABASE_URL,
    SUPABASE_ANON_KEY: REAL.SUPABASE_ANON_KEY,
  })
  assert.equal(c.hasValidConfig, true)
  assert.equal(c.hasServiceRole, false)
  assert.equal(c.accountsAvailable, false)
})

test('dev with ALLOW_MOCK_AUTH=1 and no config: mock mode on', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'development', ALLOW_MOCK_AUTH: '1' })
  assert.equal(c.isMockMode, true)
  assert.equal(c.accountsAvailable, true)
})

test('dev WITHOUT the opt-in: mock mode stays off', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'development' })
  assert.equal(c.isMockMode, false)
  assert.equal(c.accountsAvailable, false)
})

test('malformed url is not valid config', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'production', SUPABASE_URL: 'notaurl', SUPABASE_ANON_KEY: 'k' })
  assert.equal(c.hasValidConfig, false)
  assert.equal(c.accountsAvailable, false)
})

test('non-http protocol is not valid config', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'production', SUPABASE_URL: 'ftp://x.co', SUPABASE_ANON_KEY: 'k' })
  assert.equal(c.hasValidConfig, false)
})

test('empty-string env vars are treated as missing', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'production', SUPABASE_URL: '  ', SUPABASE_ANON_KEY: '' })
  assert.equal(c.hasValidConfig, false)
  assert.equal(c.accountsAvailable, false)
})

test('reason is a non-empty string when accounts are unavailable', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'production' })
  assert.equal(typeof c.reason, 'string')
  assert.ok(c.reason.length > 0)
})

// Mock mode is an all-three conjunction. Losing any one term must disable it.
test('dev, valid config, but no service key: not mock, accounts unavailable', () => {
  const c = resolveAuthConfig({
    NODE_ENV: 'development',
    ALLOW_MOCK_AUTH: '1',
    SUPABASE_URL: REAL.SUPABASE_URL,
    SUPABASE_ANON_KEY: REAL.SUPABASE_ANON_KEY,
  })
  assert.equal(c.isMockMode, false, 'real config means mock mode does not apply')
  assert.equal(c.accountsAvailable, false, 'service key is still required')
})

test('ALLOW_MOCK_AUTH must be exactly "1", not any truthy string', () => {
  const c = resolveAuthConfig({ NODE_ENV: 'development', ALLOW_MOCK_AUTH: 'true' })
  assert.equal(c.isMockMode, false)
})
