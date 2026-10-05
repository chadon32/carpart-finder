import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hashOwnerPassword,
  ownerConfig,
  verifyOwnerPassword,
  createOwnerSession,
  verifyOwnerSession,
  readOwnerCookie,
  OWNER_SESSION_MS,
} from './ownerAuth.js'
import { analyticsHashSecret, visitIdentity } from './visitIdentity.js'

const password = 'A separate owner password 123!'
const passwordHash = await hashOwnerPassword(password)
const env = {
  OWNER_EMAIL: 'owner@example.test',
  OWNER_PASSWORD_HASH: passwordHash,
  OWNER_SESSION_SECRET: 's'.repeat(48),
}
const config = ownerConfig(env)

test('owner access fails closed on absent or malformed configuration', () => {
  assert.equal(ownerConfig({}), null)
  assert.equal(ownerConfig({ ...env, OWNER_PASSWORD_HASH: password }), null)
  assert.equal(ownerConfig({ ...env, OWNER_SESSION_SECRET: 'short' }), null)
  assert.equal(ownerConfig({ ...env, OWNER_EMAIL: 'invalid' }), null)
})
test('owner password hashing is salted and never stores the password', async () => {
  assert.match(passwordHash, /^scrypt\$16384\$8\$1\$/)
  assert.equal(passwordHash.includes(password), false)
  assert.notEqual(await hashOwnerPassword(password), passwordHash)
  await assert.rejects(hashOwnerPassword('short'))
})
test('only the configured owner can sign in with the correct password', async () => {
  assert.equal(await verifyOwnerPassword(' OWNER@EXAMPLE.TEST ', password, config), true)
  assert.equal(await verifyOwnerPassword('shopper@example.test', password, config), false)
  assert.equal(await verifyOwnerPassword(env.OWNER_EMAIL, 'wrong password', config), false)
  assert.equal(await verifyOwnerPassword(env.OWNER_EMAIL, 'x'.repeat(257), config), false)
  assert.equal(await verifyOwnerPassword(env.OWNER_EMAIL, password, null), false)
})
test('owner sessions reject expiry, tampering, rotation, and malformed cookies', () => {
  const now = 1_000_000
  const session = createOwnerSession(config, now)
  assert.equal(verifyOwnerSession(session, config, now), true)
  assert.equal(verifyOwnerSession(session, config, now + OWNER_SESSION_MS), false)
  assert.equal(verifyOwnerSession(session, config, now - 1), false)
  assert.equal(verifyOwnerSession(`${session}x`, config, now), false)
  assert.equal(verifyOwnerSession(session, { ...config, secret: 't'.repeat(48) }, now), false)
  assert.equal(
    verifyOwnerSession(session, { ...config, email: 'someone@example.test' }, now),
    false,
  )
  for (const invalid of [
    '',
    'owner@example.test',
    'bad.bad',
    `${session}.extra`,
    null,
    'x'.repeat(513),
  ])
    assert.equal(verifyOwnerSession(invalid, config, now), false)
  assert.equal(readOwnerCookie({ headers: { cookie: 'cpf_owner_session=%E0%A4%A' } }), '')
})
test('daily identities store neither address, user agent, nor client session ID and rotate at Phoenix midnight', () => {
  const req = { ip: '203.0.113.20', get: () => 'Mozilla/example', socket: {} }
  const secret = analyticsHashSecret({ ANALYTICS_HASH_SECRET: 's'.repeat(48) })
  const first = visitIdentity(req, 'client-session', secret, new Date('2026-10-06T06:59:59Z'))
  const second = visitIdentity(req, 'client-session', secret, new Date('2026-10-06T07:00:00Z'))
  assert.match(first.sessionHash, /^[a-f0-9]{64}$/)
  assert.match(first.visitorHash, /^[a-f0-9]{64}$/)
  assert.notEqual(first.visitorHash, second.visitorHash)
  assert.notEqual(first.sessionHash, second.sessionHash)
  assert.notEqual(first.visitorHash, first.sessionHash)
  assert.equal(JSON.stringify(first).includes(req.ip), false)
  assert.equal(analyticsHashSecret({}), null)
})
