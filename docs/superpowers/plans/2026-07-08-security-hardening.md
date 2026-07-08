# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a live authentication bypass in production, then harden the remaining 13 audited defects.

**Architecture:** The auth fail-open bug (`isMockMode` inferred from missing config) is fixed by extracting a **pure resolver function** that maps an environment object to an auth-config verdict. Pure means unit-testable without module-cache or env tricks. A `requireAccountsAvailable` middleware gates every account route except `/logout`. Rate limiters mount in `api/index.js` alongside the existing ones so all rate-limit policy lives in one file. Phase 2 fixes are independent of each other and of Phase 1.

**Tech Stack:** Node 24, Express 5, `express-rate-limit` v8 (already a dependency), Supabase JS v2, React 19 + Vite 8, TypeScript.

**Source spec:** `docs/superpowers/specs/2026-07-08-security-hardening-design.md`

## Global Constraints

- **No new runtime dependencies.** Tests use Node 24's built-in `node:test` and `node:assert/strict`. HTTP tests bind the app with `app.listen(0)` and use global `fetch`. Do not add `supertest`, `vitest`, `jest`, or `@testing-library/*`.
- **`api/index.js` is the single source of truth for the Express app.** `server/index.js` only calls `app.listen()`. Vercel deploys `api/index.js`. Never duplicate routes.
- **Tailwind v4 cannot `@apply` one custom component class inside another.** Compose variants in markup.
- **Rate-limit policy lives in `api/index.js` only.** Do not mount limiters inside `server/routes/*`.
- **`express-rate-limit` v8 option name:** this codebase uses `max`. Keep using `max` for consistency with the existing `searchLimiter` / `aiLimiter`.
- **Honesty guardrail:** never introduce fabricated listings, prices, sellers, or fake success states. An unavailable feature says it is unavailable.
- **Test file naming:** `*.test.js` colocated with the module under test. The `test` script uses **explicit quoted globs**, not bare `node --test` and not a bare directory argument. Verified on this machine (Node v24.15.0, Windows + Git Bash): a bare directory argument is treated as a module entry point and crashes, and bare `node --test` auto-discovers `**/test-*.js`, which would execute `server/test-gemini.js` and fire a live billable Gemini request. The quoted-glob form runs exactly the intended files.
- **Existing test script:** `npm run test:diagnose` must keep passing.
- **Phase 1 ships as one deployable unit.** Work on branch `security/phase-1-fail-closed-auth`; commit per task; deploy the branch as a whole.

---

## File Structure

**Phase 1 — Create:**
- `server/config.js` — pure `resolveAuthConfig(env)` resolver. No side effects, no imports of Supabase. One responsibility: decide whether accounts can function.
- `server/config.test.js` — exhaustive unit tests for the resolver. This is where the critical bug is pinned.
- `server/middleware/accountsAvailable.js` — `requireAccountsAvailable` middleware.
- `server/middleware/accountsAvailable.test.js` — middleware unit tests with fake req/res.
- `server/routes/supabase.prod-unconfigured.test.js` — integration: production + no Supabase ⇒ 503, logout still 200, cookie forgery rejected.
- `server/routes/supabase.ratelimit.test.js` — integration: 11th login attempt ⇒ 429.

**Phase 1 — Delete:**
- `server/test-gemini.js` — leaks `GEMINI_API_KEY` in a URL query string, and matches the `**/test-*.js` discovery pattern, so it must go before `npm test` exists.

**Phase 1 — Modify:**
- `server/supabase.js` — consume the resolver; export `accountsAvailable`; remove the silent `supabaseAdmin → anon` fallback (`supabaseAdmin` becomes `null` when unusable).
- `server/routes/supabase.js` — reorder so `/logout` is defined before the gate; mount gate; require a real password in the mock branch.
- `server/workers/priceChecker.js` — guard against `supabaseAdmin === null`.
- `api/index.js` — add `authLimiter`, `subscribeLimiter`, `writeLimiter`.
- `src/contexts/AppContext.tsx` — revalidate cached user against `/me` on boot; clear local + server session on failure.
- `src/components/Dashboard.tsx` — honest 503 state.
- `package.json` — add `"test": "node --test server/"`.
- `server/.env.example` — document `ALLOW_MOCK_AUTH`.

**Phase 2 — Create:**
- `server/lib/html.js` — `escapeHtml()` and `safeListingUrl()`. Shared, pure, testable.
- `server/lib/html.test.js`
- `server/lib/concurrency.js` — `mapWithConcurrency()`.
- `server/lib/concurrency.test.js`
- `api/index.test.js` — error handler, 404, CORS 403, `/api/prices` cap.

**Phase 2 — Modify:**
- `api/index.js` — `/api/prices` cap + limiter; global error handler; 404 handler; CORS → 403; `vehicleError` on `/api/vehicle-image`.
- `server/providers/ebay.js` — bounded concurrency in `getCurrentPrices`.
- `server/workers/priceChecker.js` — escape email HTML; validate link.
- `server/vehicleImages.js` — LRU cap; delete `imagePromises` in `finally`.
- `server/routes/supabase.js` — stop leaking `error.message`; delete `mockGuestSubscriptions`.
- `server/middleware/auth.js` — anchored `Bearer` parse.
- `vercel.json` — document security headers + CSP.
- `index.html` — record the CJ-script accepted-risk decision.

---

# PHASE 1 — Emergency Patch

### Task 1: Pure auth-config resolver

This is the task that closes the live bypass. Everything else in Phase 1 depends on it.

**Files:**
- Create: `server/config.js`
- Create: `server/config.test.js`
- Delete: `server/test-gemini.js`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveAuthConfig(env: object) => { hasValidConfig: boolean, hasServiceRole: boolean, isMockMode: boolean, accountsAvailable: boolean, reason: string }`. Used by `server/supabase.js` (Task 2).

- [ ] **Step 1: Delete `server/test-gemini.js`**

```bash
git rm server/test-gemini.js
```

It passes `GEMINI_API_KEY` in a URL query string, where it lands in proxy logs and shell history (audit finding L11). It is also a booby trap for the test suite this task introduces: Node's *default* discovery pattern includes `**/test-*.js`, so a future `npm test` written the obvious way would execute it and fire a live, billable Gemini request. Removing it now means the trap cannot be re-armed by someone simplifying the test script later.

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block, add the `test` entry immediately before `test:diagnose`. Both directories are listed because Phase 2 adds `api/index.test.js`:

```json
    "test": "node --test server/ api/",
    "test:diagnose": "node server/scripts/testDiagnosis.js"
```

`api/` contains no test file until Task 12; Node's runner exits 0 on a directory with no matches, so this is safe from the start.

- [ ] **Step 3: Write the failing test**

Create `server/config.test.js`:

```js
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
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './config.js'`

- [ ] **Step 5: Write the implementation**

Create `server/config.js`:

```js
// Pure resolver: environment -> auth-config verdict. No side effects, no
// network, no Supabase import — so the security-critical decision below is
// exhaustively unit-testable (see config.test.js).
//
// The bug this exists to kill: mock mode used to be *inferred* from missing
// configuration, so a single absent env var in production silently turned the
// auth system into a no-op that accepted any password for any email. Mock mode
// is now an explicit, development-only opt-in. Missing config fails CLOSED.

function isValidHttpUrl(value) {
  if (!value) return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function resolveAuthConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim()
  const anonKey = env.SUPABASE_ANON_KEY?.trim()
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const isProduction = env.NODE_ENV === 'production'

  const hasValidConfig = isValidHttpUrl(url) && Boolean(anonKey)
  const hasServiceRole = Boolean(serviceKey)

  // Mock mode requires ALL THREE: no real config, not production, and an
  // explicit opt-in. Production can never reach it, whatever the env says.
  const isMockMode = !hasValidConfig && !isProduction && env.ALLOW_MOCK_AUTH === '1'

  // Every authenticated write path uses the service-role client, so a missing
  // service key means accounts cannot actually function — report unavailable
  // rather than silently degrading to the anon client (which RLS then blocks).
  const accountsAvailable = (hasValidConfig && hasServiceRole) || isMockMode

  let reason = ''
  if (accountsAvailable) {
    reason = isMockMode ? 'mock mode (development opt-in)' : 'supabase configured'
  } else if (!hasValidConfig) {
    reason =
      `Supabase is not configured (url=${url ? 'set' : 'missing'}, ` +
      `anonKey=${anonKey ? 'set' : 'missing'}). Account features are disabled.`
  } else {
    reason = 'SUPABASE_SERVICE_ROLE_KEY is missing. Account features are disabled.'
  }

  return { hasValidConfig, hasServiceRole, isMockMode, accountsAvailable, reason }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 10 passing tests from `config.test.js`, and no network call to Gemini.

- [ ] **Step 7: Commit**

```bash
git checkout -b security/phase-1-fail-closed-auth
git add server/config.js server/config.test.js package.json
git rm --cached server/test-gemini.js 2>/dev/null || true
git commit -m "Add pure auth-config resolver; delete key-leaking test script

Mock mode becomes an explicit development-only opt-in. Production with
missing Supabase config now fails closed instead of authenticating
every credential. Deletes server/test-gemini.js, which leaked
GEMINI_API_KEY via a URL query string and would be auto-executed by the
node:test discovery pattern **/test-*.js."
```

---

### Task 2: Wire the resolver into `supabase.js`, remove the anon fallback

**Files:**
- Modify: `server/supabase.js` (full rewrite, 52 lines → below)
- Modify: `server/workers/priceChecker.js:34-45` (guard null admin client)

**Interfaces:**
- Consumes: `resolveAuthConfig` from Task 1.
- Produces: `supabase`, `supabaseAdmin` (a `SupabaseClient` **or `null`**), `isMockMode: boolean`, `accountsAvailable: boolean`. Consumed by `middleware/auth.js`, `routes/supabase.js`, `workers/priceChecker.js`, and `middleware/accountsAvailable.js` (Task 3).

- [ ] **Step 1: Rewrite `server/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { resolveAuthConfig } from './config.js'

// A malformed or half-configured Supabase env used to silently enable mock
// mode. It no longer can: resolveAuthConfig fails closed in production. This
// module still must not throw at import time, because it is imported by the
// single Vercel serverless function — a throw here would take down the search
// endpoints too, which need no database at all.
const config = resolveAuthConfig(process.env)

export const isMockMode = config.isMockMode
export const accountsAvailable = config.accountsAvailable

if (!accountsAvailable) {
  // An error, not a warning: in production this means the login form is dark.
  console.error(`[auth] ACCOUNTS DISABLED — ${config.reason}`)
} else if (isMockMode) {
  console.warn('⚠️ [auth] LOCAL MOCK MODE — accounts do not persist and passwords are not verified.')
}

// createClient needs syntactically valid args even when unused.
const supabaseUrl = config.hasValidConfig ? process.env.SUPABASE_URL.trim() : 'https://mock.supabase.co'
const supabaseAnonKey = config.hasValidConfig ? process.env.SUPABASE_ANON_KEY.trim() : 'dummy-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Service-role client for server-side writes that bypass RLS. It is `null`
// when unusable — NEVER the anon client. The old fallback made every
// guest-alert insert fail silently against RLS and made authed reads return
// empty sets, because auth.uid() is null server-side. Callers are only
// reachable when accountsAvailable is true (see requireAccountsAvailable),
// and the mock branches never touch this client.
export const supabaseAdmin =
  config.hasValidConfig && config.hasServiceRole
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY.trim())
    : null
```

- [ ] **Step 2: Guard the cron worker against a null admin client**

In `server/workers/priceChecker.js`, change the import on line 12 and the guard block at lines 37-45:

```js
import { supabaseAdmin, isMockMode, accountsAvailable } from '../supabase.js'
```

Then, inside `checkPriceAlerts()`, replace the existing `if (isMockMode) { ... }` block with:

```js
  if (isMockMode) {
    console.warn('⚠️ [PriceChecker] Running in LOCAL MOCK MODE. Skipping Supabase DB lookup.')
    return { checked: 0, triggered: 0, skipped: 'mock mode' }
  }

  // supabaseAdmin is null when accounts are disabled. Without this the cron
  // would throw on `.from()` of null.
  if (!accountsAvailable || !supabaseAdmin) {
    console.warn('⚠️ [PriceChecker] Accounts are disabled (Supabase unconfigured). Skipping price check.')
    return { checked: 0, triggered: 0, skipped: 'accounts unavailable' }
  }
```

- [ ] **Step 3: Verify nothing regressed**

Run: `npm test && npm run test:diagnose && npm run build`
Expected: all resolver tests PASS, diagnosis suite PASS, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add server/supabase.js server/workers/priceChecker.js
git commit -m "Fail closed when Supabase is unconfigured; never fall back to the anon client"
```

---

### Task 3: The `requireAccountsAvailable` gate

**Files:**
- Create: `server/middleware/accountsAvailable.js`
- Create: `server/middleware/accountsAvailable.test.js`

**Interfaces:**
- Consumes: `accountsAvailable` from Task 2.
- Produces: `makeAccountsGate(available: boolean) => (req, res, next) => void` (testable factory) and the default `requireAccountsAvailable` middleware bound to the real config. Mounted by Task 4.

- [ ] **Step 1: Write the failing test**

Create `server/middleware/accountsAvailable.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './accountsAvailable.js'`

- [ ] **Step 3: Write the implementation**

Create `server/middleware/accountsAvailable.js`:

```js
import { accountsAvailable } from '../supabase.js'

// Exported as a factory so the behavior is unit-testable without touching env
// or the module cache.
export function makeAccountsGate(available) {
  return function requireAccountsAvailable(_req, res, next) {
    if (available) return next()
    // Deliberately generic: the client learns the feature is off, not why.
    // The operational detail is logged once at boot in supabase.js.
    return res.status(503).json({ error: 'Accounts are temporarily unavailable.' })
  }
}

export const requireAccountsAvailable = makeAccountsGate(accountsAvailable)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 3 new tests.

- [ ] **Step 5: Commit**

```bash
git add server/middleware/accountsAvailable.js server/middleware/accountsAvailable.test.js
git commit -m "Add requireAccountsAvailable gate returning 503 when auth cannot function"
```

---

### Task 4: Mount the gate, exempt `/logout`, require a real mock password

`/logout` must stay reachable: it takes no credentials, reads no database, and is what clears the stale `cpf_token` cookies that mock mode issued. Gating it would strand those cookies in real browsers. Express matches middleware in definition order, so defining `/logout` **before** `router.use(gate)` exempts it.

**Files:**
- Modify: `server/routes/supabase.js` (reorder routes; add gate; add mock password check)
- Create: `server/routes/supabase.prod-unconfigured.test.js`

**Interfaces:**
- Consumes: `requireAccountsAvailable` from Task 3.
- Produces: the gated router. No new exports.

- [ ] **Step 1: Write the failing integration test**

Create `server/routes/supabase.prod-unconfigured.test.js`:

```js
// Simulates the exact production state that shipped: NODE_ENV=production with
// no Supabase configuration. Env is set BEFORE importing the app, because
// server/supabase.js resolves its config at import time. dotenv does not
// override already-set vars, so the empty strings below win over any .env.
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
process.env.ALLOW_MOCK_AUTH = '1' // proves production ignores the opt-in

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => server.close())

const postJson = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

test('login is refused with 503, not a forged session', async () => {
  const res = await postJson('/api/supabase/login', { email: 'a@b.com', password: 'anything' })
  assert.equal(res.status, 503)
  assert.equal(res.headers.get('set-cookie'), null)
})

test('signup is refused with 503', async () => {
  const res = await postJson('/api/supabase/signup', { email: 'a@b.com', password: 'anything' })
  assert.equal(res.status, 503)
})

// The bypass: previously, presenting an arbitrary email as the cookie value
// authenticated the request as that user.
test('a forged cpf_token cookie cannot authenticate', async () => {
  const res = await fetch(`${base}/api/supabase/me`, {
    headers: { cookie: 'cpf_token=victim@example.com' },
  })
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.user, undefined)
})

test('the public guest-alert subscribe is also gated', async () => {
  const res = await postJson('/api/supabase/price-alerts/subscribe', {
    email: 'a@b.com', year: '2018', make: 'Honda', model: 'Civic', part: 'Brake Pads', target_price: 50,
  })
  assert.equal(res.status, 503)
})

// Exempt: this is how stale mock cookies get cleared.
test('logout still succeeds and clears the cookie', async () => {
  const res = await postJson('/api/supabase/logout', {})
  assert.equal(res.status, 200)
  assert.match(res.headers.get('set-cookie') ?? '', /cpf_token=/)
})

// The product must stay up. Search needs no database.
test('the search endpoint still validates input rather than 503ing', async () => {
  const res = await fetch(`${base}/api/search?year=2018&make=Honda`)
  assert.equal(res.status, 400) // missing `part` — reached the handler, not the gate
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — login returns 200 with a `set-cookie` header, and `/me` returns a user. That failure *is* the vulnerability.

- [ ] **Step 3: Reorder `server/routes/supabase.js` and mount the gate**

Change the import block at the top of the file:

```js
import express from 'express'
import crypto from 'node:crypto'
import { supabase, supabaseAdmin, isMockMode } from '../supabase.js'
import { requireAuth, AUTH_COOKIE } from '../middleware/auth.js'
import { requireAccountsAvailable } from '../middleware/accountsAvailable.js'
```

Then move the existing `/logout` handler so it sits immediately after the `mockGuestSubscriptions` declarations and **before** every other route, followed by the gate:

```js
// Defined BEFORE the gate on purpose. Logout takes no credentials and reads no
// database; it must keep working even when accounts are disabled, so browsers
// holding a stale cpf_token (issued by the old mock mode) can clear it.
router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ success: true })
})

// Everything below requires that accounts can actually function. When Supabase
// is unconfigured this returns 503 rather than authenticating against nothing.
router.use(requireAccountsAvailable)
```

Delete the old `/logout` definition further down the file (the one at former line 173).

- [ ] **Step 4: Require a real password in the mock branches**

In the `/signup` handler, replace the existing validation with:

```js
  const { email, password, name } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  // Mock mode must exercise the same validation shape as production, so local
  // development cannot pass a credential that real Supabase would reject.
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
```

In the `/login` handler, replace the existing validation with:

```js
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Invalid email or password' })
  }
```

Note the deliberately different copy: signup names the rule, login does not confirm which half of the credential was wrong.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all 6 integration tests, plus the earlier unit tests.

- [ ] **Step 6: Verify the local mock flow still works**

Run: `npm run test:diagnose`
Expected: PASS.

Then confirm the dev path by hand:

```bash
NODE_ENV=development ALLOW_MOCK_AUTH=1 node server/index.js
# in another shell:
curl -si -X POST localhost:3001/api/supabase/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","password":"devpassword"}' | head -1
```

Expected: `HTTP/1.1 200 OK`. Then stop the server.

- [ ] **Step 7: Commit**

```bash
git add server/routes/supabase.js server/routes/supabase.prod-unconfigured.test.js
git commit -m "Gate all account routes behind requireAccountsAvailable; exempt logout"
```

---

### Task 5: Rate-limit the auth surface

**Files:**
- Modify: `api/index.js` (add three limiters after the existing `aiLimiter` mounts, ~line 114)
- Create: `server/routes/supabase.ratelimit.test.js`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: no exports. Behavioral only.

- [ ] **Step 1: Write the failing test**

Create `server/routes/supabase.ratelimit.test.js`:

```js
// Mock mode so /login reaches the handler rather than the 503 gate — we are
// testing the limiter, which sits in front of both.
process.env.NODE_ENV = 'development'
process.env.ALLOW_MOCK_AUTH = '1'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../../api/index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => server.close())

test('the 11th login attempt in the window is rate limited', async () => {
  const attempt = () =>
    fetch(`${base}/api/supabase/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'brute@example.com', password: 'wrongpassword' }),
    })

  const statuses = []
  for (let i = 0; i < 11; i++) statuses.push((await attempt()).status)

  assert.ok(!statuses.slice(0, 10).includes(429), 'first 10 attempts must not be limited')
  assert.equal(statuses[10], 429, 'the 11th attempt must be limited')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — the 11th attempt returns 200, not 429. Unlimited brute force.

- [ ] **Step 3: Add the limiters to `api/index.js`**

Immediately after the existing `app.use('/api/ai', aiLimiter)` line, insert:

```js
// The account surface had NO rate limiting at all: unlimited password
// brute-force against /login, unlimited account creation via /signup, and
// unlimited unauthenticated row insertion via the public subscribe endpoint.
// Order matters — the narrowest paths mount first, so a login attempt is
// charged to authLimiter rather than the general write budget.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Failed logins are the ones worth counting, but counting successes too
  // costs a legitimate user nothing (they log in once) and stops an attacker
  // from harvesting valid credentials cheaply once they find one.
})

const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many alert subscriptions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/supabase/login', authLimiter)
app.use('/api/supabase/signup', authLimiter)
app.use('/api/supabase/price-alerts/subscribe', subscribeLimiter)
app.use('/api/supabase', writeLimiter)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all tests including the new 429 assertion.

- [ ] **Step 5: Commit**

```bash
git add api/index.js server/routes/supabase.ratelimit.test.js
git commit -m "Rate-limit login, signup, guest subscribe, and account writes"
```

---

### Task 6: Invalidate the stale mock sessions

Phase 1 creates a foreseeable breakage: real browsers hold a `carpartsradar-user` object in `localStorage` and a `cpf_token` cookie issued by the old mock logins. After the gate ships, that state renders a logged-in UI whose every action 503s. This task cleans it up.

There is **no React test runner in this project** and the Global Constraints forbid adding one. Verification for this task is `npm run build` plus the scripted manual check in Step 4. Do not fabricate a passing test.

**Files:**
- Modify: `src/contexts/AppContext.tsx:44-57`
- Modify: `src/components/Dashboard.tsx` (auth-error rendering)

**Interfaces:**
- Consumes: `getCurrentUser`, `logoutUser`, `ApiError` — all already exported from `src/api/supabase.ts`.
- Produces: nothing new.

- [ ] **Step 1: Revalidate the cached user on boot**

In `src/contexts/AppContext.tsx`, add the import:

```tsx
import { getCurrentUser, logoutUser } from '../api/supabase'
```

Then add this effect immediately after the existing `darkMode` effect:

```tsx
  // A cached user in localStorage is a UI hint, never proof of a session. The
  // server holds the real answer in an httpOnly cookie we cannot read. Confirm
  // it once on boot and clear both sides if the session is gone — this is what
  // logs out anyone still holding a session minted by the old mock-mode auth,
  // which accepted any password for any email.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    getCurrentUser()
      .catch(async () => {
        if (cancelled) return
        await logoutUser() // clears the stale cpf_token cookie server-side
        localStorage.removeItem('carpartsradar-user')
        setUser(null)
      })
    return () => { cancelled = true }
    // Boot-only: re-running on every user change would log out the user we
    // just logged in, before the cookie round-trips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
```

- [ ] **Step 2: Render an honest 503 state in `Dashboard.tsx`**

`ApiError` already carries `.status`. In the `catch` block of `handleAuth` (around line 99), replace the generic handler:

```tsx
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 503) {
        setAuthError('Accounts are temporarily unavailable. Search and price comparison still work.')
      } else {
        setAuthError(err.message || 'Authentication failed.')
      }
    } finally {
```

Add `ApiError` to the existing import from `../api/supabase`.

Note: `signupUser` / `loginUser` currently throw a plain `Error`, not `ApiError`. Fix them in `src/api/supabase.ts` so the status survives — in **both** functions, replace the throw:

```ts
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new ApiError(errorData.error || 'Failed to log in', res.status)
  }
```

(Use `'Failed to sign up'` in `signupUser`.) `ApiError` extends `Error`, so `err.message` still works for every existing caller.

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: `✓ built` with no TypeScript errors.

- [ ] **Step 4: Manual verification of the logout path**

```bash
NODE_ENV=production node server/index.js   # accounts disabled, as in prod
```

In a second shell, start the frontend with `npm run dev`. Then in the browser console on `localhost:5173`:

```js
localStorage.setItem('carpartsradar-user', JSON.stringify({name:'Ghost', email:'ghost@example.com'}))
document.cookie = 'cpf_token=ghost@example.com; path=/'
location.reload()
```

Expected after reload: the header shows **Account**, not "Ghost". `localStorage.getItem('carpartsradar-user')` returns `null`. No uncaught errors in the console. Clicking Account and attempting to log in shows "Accounts are temporarily unavailable. Search and price comparison still work." Searching for a part still returns live listings.

- [ ] **Step 5: Document the opt-in and commit**

Append to `server/.env.example`:

```
# Local development only. Set to 1 to run account features against an
# in-memory mock instead of Supabase. IGNORED in production: an unconfigured
# production deploy disables accounts (503) rather than accepting any password.
ALLOW_MOCK_AUTH=0
```

```bash
git add src/contexts/AppContext.tsx src/components/Dashboard.tsx src/api/supabase.ts server/.env.example
git commit -m "Revalidate cached sessions on boot; show honest state when accounts are disabled"
```

---

### Task 7: Phase 1 acceptance

**Files:** none modified.

- [ ] **Step 1: Run the full suite**

```bash
npm test && npm run test:diagnose && npm run build && npm run lint
```

Expected: all pass.

- [ ] **Step 2: Confirm every Phase 1 acceptance criterion from the spec**

Walk `docs/superpowers/specs/2026-07-08-security-hardening-design.md` §1.5 and check each line against the tests now in the repo:

- production + no Supabase ⇒ `/login` 503, `/api/search` reachable → `supabase.prod-unconfigured.test.js`
- forged `cpf_token` ⇒ 503, not 200 → `supabase.prod-unconfigured.test.js`
- `/logout` still 200 → `supabase.prod-unconfigured.test.js`
- `ALLOW_MOCK_AUTH=1` + development ⇒ local flow unchanged → Task 4 Step 6
- 11th login ⇒ 429 → `supabase.ratelimit.test.js`
- stale mock session ⇒ logged out cleanly → Task 6 Step 4

- [ ] **Step 3: Merge and deploy**

```bash
git checkout main
git merge --no-ff security/phase-1-fail-closed-auth -m "Phase 1: fail-closed auth and rate limiting"
```

Deploy. **Confirm on production:** `curl -si https://carpartsradar.com/api/supabase/me -H 'cookie: cpf_token=test@example.com' | head -1` returns `HTTP/2 503`.

---

# PHASE 2 — Hardening

Reviewed and committed separately. Each task is independent; they may be done in any order. Branch: `security/phase-2-hardening`.

### Task 8: Bound `/api/prices` fan-out

**Files:**
- Create: `server/lib/concurrency.js`, `server/lib/concurrency.test.js`
- Modify: `server/providers/ebay.js:13-49`, `api/index.js:165-179`

**Interfaces:**
- Produces: `mapWithConcurrency(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) => Promise<R[]>` — preserves input order. The `index` argument is passed but unused by the eBay caller.

- [ ] **Step 1: Write the failing test**

Create `server/lib/concurrency.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { mapWithConcurrency } from './concurrency.js'

test('preserves input order', async () => {
  const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10)
  assert.deepEqual(out, [10, 20, 30, 40])
})

test('never exceeds the concurrency limit', async () => {
  let active = 0
  let peak = 0
  await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
    active++
    peak = Math.max(peak, active)
    await new Promise((r) => setTimeout(r, 5))
    active--
  })
  assert.ok(peak <= 3, `peak concurrency was ${peak}`)
})

test('handles an empty list', async () => {
  assert.deepEqual(await mapWithConcurrency([], 5, async (x) => x), [])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './concurrency.js'`

- [ ] **Step 3: Implement**

Create `server/lib/concurrency.js`:

```js
// Bounded parallel map. Preserves input order. Used wherever a user-supplied
// list drives outbound requests, so one HTTP GET cannot fan out into hundreds
// of upstream calls.
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }

  const size = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: size }, worker))
  return results
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Use it in `getCurrentPrices`**

In `server/providers/ebay.js`, add the import and replace the `Promise.all` in `getCurrentPrices`:

```js
import { mapWithConcurrency } from '../lib/concurrency.js'
```

Change `const entries = await Promise.all(ids.map(async (id) => {` to:

```js
  // Bounded: `ids` is user-supplied. An unbounded Promise.all here turned one
  // GET /api/prices into one outbound eBay call per id, with no ceiling.
  const entries = await mapWithConcurrency(ids, 5, async (id) => {
```

and close it with `})` instead of `}))`.

- [ ] **Step 6: Cap the id list and rate-limit the route**

In `api/index.js`, add the limiter mount next to the others:

```js
app.use('/api/prices', searchLimiter)
```

and replace the id-parsing block in the `/api/prices` handler:

```js
// One outbound eBay call is made per id, so this list must be bounded.
const MAX_PRICE_IDS = 20

app.get('/api/prices', async (req, res) => {
  const ids = req.query.ids ? String(req.query.ids).split(',').filter(Boolean) : []
  if (ids.length === 0) {
    return res.status(400).json({ error: 'ids query param is required' })
  }
  if (ids.length > MAX_PRICE_IDS) {
    return res.status(400).json({ error: `A maximum of ${MAX_PRICE_IDS} ids may be requested at once` })
  }
```

(The rest of the handler is unchanged.)

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run build`

```bash
git add server/lib/concurrency.js server/lib/concurrency.test.js server/providers/ebay.js api/index.js
git commit -m "Cap /api/prices at 20 ids and bound eBay fan-out concurrency"
```

---

### Task 9: Escape seller-controlled data in outbound email

`listing.title`, `listing.seller`, and `listing.link` are eBay-seller-controlled. They are currently interpolated raw into email HTML, with the link inside an `href` attribute.

**Files:**
- Create: `server/lib/html.js`, `server/lib/html.test.js`
- Modify: `server/workers/priceChecker.js:148-188`

**Interfaces:**
- Produces: `escapeHtml(value: unknown) => string` and `safeListingUrl(value: unknown) => string | null`.

- [ ] **Step 1: Write the failing test**

Create `server/lib/html.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, safeListingUrl } from './html.js'

test('escapes the five XML-significant characters', () => {
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;')
})

test('neutralizes an attribute-breakout payload', () => {
  const payload = '"><script>alert(1)</script>'
  const out = escapeHtml(payload)
  assert.ok(!out.includes('<script>'))
  assert.ok(!out.includes('">'))
})

test('coerces non-strings safely', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
  assert.equal(escapeHtml(42), '42')
})

test('accepts a normal https eBay url', () => {
  const url = 'https://www.ebay.com/itm/12345'
  assert.equal(safeListingUrl(url), url)
})

test('rejects javascript: urls', () => {
  assert.equal(safeListingUrl('javascript:alert(1)'), null)
})

test('rejects non-eBay hosts', () => {
  assert.equal(safeListingUrl('https://evil.example/itm/1'), null)
})

test('rejects a lookalike host', () => {
  assert.equal(safeListingUrl('https://ebay.com.evil.example/x'), null)
})

test('rejects http (non-TLS)', () => {
  assert.equal(safeListingUrl('http://www.ebay.com/itm/1'), null)
})

test('rejects garbage', () => {
  assert.equal(safeListingUrl('not a url'), null)
  assert.equal(safeListingUrl(null), null)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './html.js'`

- [ ] **Step 3: Implement**

Create `server/lib/html.js`:

```js
// Escaping + URL validation for anything that reaches an HTML email body.
// Listing titles, seller names, and links come from eBay sellers, i.e. from
// the public internet. Treat every one of them as hostile.

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  // & must be replaced first or the other entities get double-escaped.
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch])
}

// Only an https eBay URL may ever land in an href. Anything else — a
// javascript: scheme, a lookalike host, a redirector — is dropped entirely.
const ALLOWED_HOST = /(^|\.)ebay\.com$/

export function safeListingUrl(value) {
  if (!value) return null
  let url
  try {
    url = new URL(String(value))
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (!ALLOWED_HOST.test(url.hostname.toLowerCase())) return null
  return url.href
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS — 9 tests.

- [ ] **Step 5: Apply to the email template**

In `server/workers/priceChecker.js`, add the import:

```js
import { escapeHtml, safeListingUrl } from '../lib/html.js'
```

Replace the body of `sendPriceDropEmail`'s `html` field. The full replacement for the `fetch` body block:

```js
  const safeVehicle = escapeHtml(vehicle)
  const safePart = escapeHtml(searchLike.part)
  const safeTitle = escapeHtml(listing.title)
  const safeSeller = escapeHtml(listing.seller)
  const href = safeListingUrl(listing.link)
  const price = currentPrice.toFixed(2)
  const target = Number(targetPrice).toFixed(2)

  // Drop the link entirely rather than emit an unvalidated href.
  const listingLine = href
    ? `<p><a href="${href}">${safeTitle}</a><br/>Sold by ${safeSeller}${listing.shippingCost === 0 ? ' · free shipping' : ''}</p>`
    : `<p>${safeTitle}<br/>Sold by ${safeSeller}</p>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'CarPartsRadar <onboarding@resend.dev>',
      to: [email],
      subject: `Price drop: ${searchLike.part} for your ${vehicle} — now $${price}`,
      html: `
        <p>Good news — a <strong>${safePart}</strong> matching your price alert for a
        <strong>${safeVehicle}</strong> just dropped to <strong>$${price}</strong>
        (your target was $${target}).</p>
        ${listingLine}
        <p style="color:#64748b;font-size:12px">You're receiving this because you set a price alert on CarPartsRadar.
        This alert has now been fulfilled and won't email you again.</p>
      `,
    }),
  })
```

The `subject` line needs no escaping — it is a header, not HTML — but keep it free of newlines by leaving the existing `clamp`-free values as they are; Resend rejects header injection.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run build`

```bash
git add server/lib/html.js server/lib/html.test.js server/workers/priceChecker.js
git commit -m "Escape seller-controlled strings and validate listing URLs in price-drop email"
```

---

### Task 10: Real security headers on the document

The CSP currently lands only on API JSON responses. The HTML document is served by Vercel's static host and never sees it.

**Files:**
- Modify: `vercel.json`
- Modify: `index.html` (record the CJ decision)
- Modify: `api/index.js` (drop the now-redundant document-oriented headers)

- [ ] **Step 1: Add a `headers` block to `vercel.json`**

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api" }
  ],
  "crons": [
    { "path": "/api/cron/check-alerts", "schedule": "0 13 * * *" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' https://www.anrdoezrs.net https://www.dpbolvw.net https://www.tqlkg.com https://us.i.posthog.com https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ]
}
```

Each allowance is load-bearing, verified against this codebase:

- `style-src 'unsafe-inline'` — Vite injects inline styles and Tailwind emits a style element. Removing this breaks all styling.
- `font-src fonts.gstatic.com` + `style-src fonts.googleapis.com` — the Barlow Condensed / Inter / JetBrains Mono link in `index.html`.
- `img-src https:` — listing images come from eBay CDNs whose hostnames rotate, and vehicle photos from Wikimedia. An enumerated list would break the product.
- The three CJ hosts — `am.js` loads sibling scripts from CJ's redirect domains.
- **PostHog needs `script-src`, not just `connect-src`.** `src/lib/analytics.ts:10` bundles `posthog-js` via npm, but the library fetches its recorder/surveys bundles from `api_host` at runtime. `connect-src` alone would silently break session recording.

- [ ] **Step 2: Confirm the PostHog host matches this deploy**

`src/lib/analytics.ts:5` reads `VITE_POSTHOG_HOST` with a fallback of `https://us.i.posthog.com`, which is what the CSP above allow-lists. If `VITE_POSTHOG_HOST` is set to a different value (an EU instance or a reverse proxy) in the Vercel environment, add that host to **both** `script-src` and `connect-src`:

```bash
grep -n "POSTHOG_HOST" src/lib/analytics.ts   # confirms the default
```

Expected output: `const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'`

- [ ] **Step 3: Record the CJ accepted-risk decision in `index.html`**

Replace the existing CJ comment:

```html
    <!-- CJ (Commission Junction) Page-Based Link auto-monetization: rewrites
         outbound clicks to joined CJ advertisers into tracked affiliate links.

         ACCEPTED RISK: this is a third-party script with full DOM access, and
         Subresource Integrity is not possible because CJ rotates the file's
         contents. A CJ compromise is a compromise of every visitor. It is
         allow-listed explicitly in the CSP in vercel.json rather than being
         covered by a blanket policy, so removing CJ also closes the hole.
         Revisit if the affiliate revenue stops justifying the exposure. -->
    <script src="https://www.anrdoezrs.net/am/101820027/impressions/page/am.js"></script>
```

- [ ] **Step 4: Remove the redundant header block from `api/index.js`**

The API still wants `nosniff` and `no-store`, but `X-Frame-Options`, `Referrer-Policy`, HSTS, and CSP on a JSON response do nothing. Replace the middleware at `api/index.js:65-78`:

```js
app.use((_req, res, next) => {
  // JSON API responses: never cache, never sniff. The document-level policy
  // (CSP, HSTS, frame-ancestors) lives in vercel.json, because those headers
  // are meaningless on an API response — only the HTML document enforces them.
  res.set('Cache-Control', 'no-store')
  res.set('X-Content-Type-Options', 'nosniff')
  next()
})
```

- [ ] **Step 5: Verify**

Run: `npm run build`

After deploying, confirm the document carries the policy:

```bash
curl -sI https://carpartsradar.com/ | grep -iE 'content-security-policy|strict-transport'
```

Expected: both headers present. Then load the site and confirm the browser console shows **no CSP violation errors**, fonts render, listing images load, and an outbound affiliate click still works.

- [ ] **Step 6: Commit**

```bash
git add vercel.json index.html api/index.js
git commit -m "Serve CSP and security headers on the document, not just the API"
```

---

### Task 11: Fix the `vehicleImages` memory leak

**Files:**
- Modify: `server/vehicleImages.js:16-19, 74-109`

- [ ] **Step 1: Add an LRU cap and clean up the promise map**

Replace the cache declarations:

```js
// Long-lived cache: a model's representative photo essentially never changes,
// and "no match found" is just as stable, so we cache both outcomes. Capped,
// because the key space is derived from user-supplied query params.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CACHE_SIZE = 500
const cache = new Map()
const imagePromises = new Map()

function evictOldestIfNeeded() {
  if (cache.size > MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value
    cache.delete(oldestKey)
  }
}
```

Then in `getVehicleImage`, wrap the promise body so the in-flight entry is always removed, and evict on insert:

```js
  const promise = (async () => {
    let imageUrl = null
    try {
      if (year) {
        imageUrl = (await fromCommonsSearch(`${year} ${make} ${model}`)) || (await fromWikipediaArticle(`${year} ${make} ${model}`))
      }
      if (!imageUrl) {
        imageUrl = (await fromWikipediaArticle(`${make} ${model}`)) || (await fromCommonsSearch(`${make} ${model}`))
      }
    } catch {
      // Cosmetic feature: any failure is just "no image".
      imageUrl = null
    }

    evictOldestIfNeeded()
    cache.set(key, { imageUrl, expiresAt: Date.now() + CACHE_TTL_MS })
    return imageUrl
  })().finally(() => {
    // Without this, one promise leaked per unique make::model, forever.
    imagePromises.delete(key)
  })

  imagePromises.set(key, promise)
  return promise
```

- [ ] **Step 2: Verify and commit**

Run: `npm test && npm run build`

Then confirm the cache still serves:

```bash
node -e "import('./server/vehicleImages.js').then(async m => {
  console.log(await m.getVehicleImage('Honda','Civic','2018'))
  console.log(await m.getVehicleImage('Honda','Civic','2018'))
})"
```

Expected: two identical URLs (or two `null`s), printed quickly — the second is a cache hit.

```bash
git add server/vehicleImages.js
git commit -m "Cap the vehicle-image cache and stop leaking in-flight promises"
```

---

### Task 12: Global error handler, 404, and a real CORS rejection

**Files:**
- Modify: `api/index.js` (CORS callback; append handlers at the bottom, before `export default app`)
- Create: `api/index.test.js`

- [ ] **Step 1: Write the failing test**

Create `api/index.test.js`:

```js
process.env.NODE_ENV = 'production'
process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''

import test from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('./index.js')

const server = app.listen(0)
const { port } = server.address()
const base = `http://127.0.0.1:${port}`
test.after(() => server.close())

test('an unknown route returns a 404 JSON body, not HTML', async () => {
  const res = await fetch(`${base}/api/does-not-exist`)
  assert.equal(res.status, 404)
  assert.match(res.headers.get('content-type') ?? '', /application\/json/)
  assert.equal((await res.json()).error, 'Not found')
})

test('malformed JSON returns 400 JSON, not an HTML stack page', async () => {
  const res = await fetch(`${base}/api/ai/repair-guide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ this is not json',
  })
  assert.equal(res.status, 400)
  assert.match(res.headers.get('content-type') ?? '', /application\/json/)
})

test('a disallowed Origin gets 403, not 500', async () => {
  const res = await fetch(`${base}/api/search?year=2018&make=Honda&model=Civic&part=Brake+Pads`, {
    headers: { Origin: 'https://evil.example' },
  })
  assert.equal(res.status, 403)
})

test('over-long ids on /api/prices are rejected', async () => {
  const ids = Array.from({ length: 21 }, (_, i) => `ebay-${i}`).join(',')
  const res = await fetch(`${base}/api/prices?ids=${ids}`)
  assert.equal(res.status, 400)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — 404 returns Express's HTML page; the CORS case returns 500.

- [ ] **Step 3: Make the CORS rejection a flag, not a throw**

In `api/index.js`, replace the CORS `origin` callback's final branch. A thrown `Error` reaches the error handler as a 500; instead, signal disallowed and reject explicitly afterwards:

```js
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)

    if (process.env.NODE_ENV !== 'production') {
      if (origin.startsWith('http://192.168.') || origin.startsWith('http://10.')) {
        return callback(null, true)
      }
    }

    if (allowedOrigins.includes(origin)) return callback(null, true)

    // Do not throw: an Error here becomes an opaque 500. Signal "not allowed"
    // and let the guard below turn it into an honest 403.
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// cors() omits the CORS headers for a disallowed origin but still calls next().
// A browser would block the response, but a non-browser client would not — so
// reject the request outright.
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && !allowedOrigins.includes(origin)) {
    const isDevLan =
      process.env.NODE_ENV !== 'production' &&
      (origin.startsWith('http://192.168.') || origin.startsWith('http://10.'))
    if (!isDevLan) return res.status(403).json({ error: 'Origin not allowed' })
  }
  next()
})
```

- [ ] **Step 4: Add the 404 and error handlers**

Immediately before `export default app`:

```js
// Anything that reached here matched no route.
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Terminal error handler. Four arguments — Express identifies it by arity.
// Without this, express.json()'s SyntaxError on a malformed body falls through
// to Express's default handler, which replies with an HTML page.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Malformed JSON body' })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' })
  }
  // Log the detail; return none of it.
  console.error('[api] Unhandled error:', err?.message, err?.stack)
  res.status(500).json({ error: 'Something went wrong' })
})
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test`
Expected: PASS — 4 new tests. (The `/api/prices` cap test passes because of Task 8; if Task 8 has not been done, do it first.)

- [ ] **Step 6: Commit**

```bash
git add api/index.js api/index.test.js
git commit -m "Add 404 and error handlers; reject disallowed origins with 403"
```

---

### Task 13: Stop leaking Postgres error text

**Files:**
- Modify: `server/routes/supabase.js` (six `error.message` returns)

- [ ] **Step 1: Replace every client-facing `error.message`**

There are six sites returning raw Postgres text. Apply the same shape to each: log the detail, return generic copy. In order of appearance:

```js
// GET /saved-searches
if (error) {
  console.error('[supabase] fetch saved searches failed:', error.message)
  return res.status(500).json({ error: 'Could not load your saved searches' })
}

// POST /saved-searches
if (error) {
  console.error('[supabase] insert saved search failed:', error.message)
  return res.status(500).json({ error: 'Could not save that search' })
}

// DELETE /saved-searches/:id
if (error) {
  console.error('[supabase] delete saved search failed:', error.message)
  return res.status(500).json({ error: 'Could not delete that search' })
}

// DELETE /price-alerts/:id
if (error) {
  console.error('[supabase] delete price alert failed:', error.message)
  return res.status(500).json({ error: 'Could not delete that alert' })
}

// GET /price-alerts
if (error) {
  console.error('[supabase] fetch price alerts failed:', error.message)
  return res.status(500).json({ error: 'Could not load your price alerts' })
}

// POST /price-alerts
if (error) {
  console.error('[supabase] insert price alert failed:', error.message)
  return res.status(500).json({ error: 'Could not create that alert' })
}
```

Leave the `/signup` and `/login` handlers' `error.message` alone — those are Supabase Auth's user-facing validation strings ("Invalid login credentials"), not schema internals.

- [ ] **Step 2: Verify and commit**

Run: `npm test && npm run build`

```bash
git add server/routes/supabase.js
git commit -m "Stop returning raw Postgres error text to clients"
```

---

### Task 14: Hygiene — dead code, sloppy parsing, missing validation

Three unrelated small fixes, grouped because none warrants its own review cycle. (The fourth hygiene item, deleting `server/test-gemini.js`, was pulled into Task 1 — the test runner's `**/test-*.js` discovery pattern would otherwise execute it.)

**Files:**
- Modify: `server/routes/supabase.js` (remove `mockGuestSubscriptions`)
- Modify: `server/middleware/auth.js:8-17`
- Modify: `api/index.js` (`/api/vehicle-image`)
- Create: `server/middleware/auth.test.js`

- [ ] **Step 1: Remove the dead mock array**

In `server/routes/supabase.js`, delete the `const mockGuestSubscriptions = []` declaration and the `mockGuestSubscriptions.push({...})` call in the mock branch of `/price-alerts/subscribe`. Replace the push with the log line only:

```js
  if (isMockMode) {
    console.log(`[Alert Subscription] Guest ${email} subscribed to alerts for ${year} ${make} ${model}${trim ? ` ${trim}` : ''} ${part} at target price $${price}`)
    return res.json({ success: true, message: 'Alert subscription created (Local Mock)!' })
  }
```

- [ ] **Step 2: Write the failing test for the Bearer parse**

Create `server/middleware/auth.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getAuthToken } from './auth.js'

test('reads the token from the cpf_token cookie', () => {
  assert.equal(getAuthToken({ headers: { cookie: 'a=1; cpf_token=abc123; b=2' } }), 'abc123')
})

test('url-decodes the cookie value', () => {
  assert.equal(getAuthToken({ headers: { cookie: 'cpf_token=a%20b' } }), 'a b')
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
  assert.equal(getAuthToken({ headers: { cookie: 'cpf_token=fromCookie', authorization: 'Bearer fromHeader' } }), 'fromCookie')
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test`
Expected: FAIL — the bare-token case returns `'abc123'` instead of `null`.

- [ ] **Step 4: Fix the parse**

In `server/middleware/auth.js`, replace `getAuthToken`:

```js
export function getAuthToken(req) {
  const rawCookie = req.headers.cookie || ''
  const match = rawCookie.match(/(?:^|;\s*)cpf_token=([^;]+)/)
  if (match) {
    try {
      return decodeURIComponent(match[1])
    } catch {
      return null // malformed percent-encoding
    }
  }

  // Anchored and case-insensitive. The old `.replace('Bearer ', '')` accepted a
  // bare token and stripped only the first occurrence anywhere in the string.
  const authHeader = req.headers.authorization
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)
  return bearer ? bearer[1].trim() : null
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test`
Expected: PASS — 9 new tests.

- [ ] **Step 6: Validate `/api/vehicle-image` input**

In `api/index.js`, the `vehicleError` validator is defined but never applied here. Replace the handler's validation:

```js
app.get('/api/vehicle-image', async (req, res) => {
  const { make, model, year } = req.query
  if (!make || !model) {
    return res.status(400).json({ error: 'make and model query params are required' })
  }
  // `make`/`model` become cache keys and upstream Wikipedia queries — bound them.
  for (const [label, value] of Object.entries({ make, model })) {
    if (String(value).trim().length > MAX_VEHICLE_FIELD) {
      return res.status(400).json({ error: `${label} is too long` })
    }
  }
  if (year && !validateYear(year)) {
    return res.status(400).json({ error: 'A valid model year (1980–present) is required' })
  }
```

(The rest of the handler is unchanged.) Note `vehicleError` itself is not reused directly: it requires a year, and year is optional here.

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run build && npm run lint`

```bash
git add -A
git commit -m "Hygiene: remove dead code, tighten Bearer parse, validate vehicle-image input"
```

---

### Task 15: Phase 2 acceptance

- [ ] **Step 1: Full suite**

```bash
npm test && npm run test:diagnose && npm run build && npm run lint
```

- [ ] **Step 2: Check each Phase 2 criterion from the spec**

Against `docs/superpowers/specs/2026-07-08-security-hardening-design.md`:

- 21 ids ⇒ 400 → `api/index.test.js`
- escaped title / omitted `javascript:` link → `server/lib/html.test.js`
- disallowed Origin ⇒ 403 → `api/index.test.js`
- malformed JSON ⇒ 400 JSON → `api/index.test.js`
- CSP + HSTS on the document → manual `curl -sI` after deploy (Task 10 Step 5)

- [ ] **Step 3: Merge**

```bash
git checkout main
git merge --no-ff security/phase-2-hardening -m "Phase 2: security hardening"
```

---

## Post-Deploy Follow-Up (not code)

Phase 1 leaves the Account feature returning 503 in production. To restore it:

1. Create the Supabase project.
2. Run `server/supabase-schema.sql` in the Supabase SQL editor.
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and **`SUPABASE_SERVICE_ROLE_KEY`** in the Vercel environment. All three are required — the resolver reports accounts unavailable if the service key is missing, because every authenticated write path needs it.
4. Redeploy and confirm: `curl -si https://carpartsradar.com/api/supabase/me` returns 401 (not 503), meaning the gate is open and auth is enforcing.

Until then the 503 is the honest representation of what the site can offer.
