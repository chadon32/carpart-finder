# Security Hardening Design — CarPartsRadar

**Date:** 2026-07-08
**Status:** Approved, pending implementation
**Context:** Production (carpartsradar.com) is deployed and running with Supabase unconfigured, which means the authentication system is currently a no-op that returns success.

## Problem

A full audit of the server (`api/index.js`, `server/**`) and the frontend auth/data layer found fifteen defects. Dependencies are clean (`npm audit`: 0 vulnerabilities, root and server). Every finding below is in first-party code.

The audit is recorded here in full so the fixes can be traced back to a specific defect.

### Critical

**C1 — Authentication fails open.**
`server/supabase.js:26` sets `isMockMode = true` whenever `SUPABASE_URL` / `SUPABASE_ANON_KEY` are absent or malformed, and the API continues serving. In that state:

- `server/routes/supabase.js:146` (`/login`) and `:104` (`/signup`) accept **any password for any email** — the mock branch performs no credential check whatsoever.
- `server/middleware/auth.js:26-37` treats the raw cookie value as the user's identity. Setting `cpf_token=victim@example.com` authenticates the request as that user.

There is no startup assertion that a production deploy is configured. A missing environment variable silently converts the auth system into theater that still returns `200` and a populated user object. **This is live in production today.**

**C2 — No rate limiting on any auth or write endpoint.**
`searchLimiter` covers `/api/search` and `/api/quote`; `aiLimiter` covers `/api/ai` and `/api/identify-part`. Nothing covers `/api/supabase/*`. Consequences: unlimited password brute-force and credential stuffing against `/login`; unlimited account creation via `/signup`; unlimited unauthenticated row insertion via the public `/price-alerts/subscribe` (`server/routes/supabase.js:40`), which is a database-flooding and email-quota-exhaustion vector.

### High

**H3 — `/api/prices` is an amplification DoS.**
`api/index.js:166` splits the `ids` query param on commas with no cap. `server/providers/ebay.js:16` then issues one eBay API call per id inside an unbounded `Promise.all`. A single unauthenticated, unrate-limited GET with 5,000 ids produces 5,000 concurrent outbound requests, exhausting the function's sockets and the eBay quota.

**H4 — HTML injection into outbound email.**
`server/workers/priceChecker.js:170-178` interpolates `listing.title`, `listing.seller`, and `listing.link` — all eBay-seller-controlled strings — directly into the email HTML body, with `listing.link` placed inside an `href="..."` attribute. A crafted listing title or URL escapes the attribute and injects arbitrary markup into mail sent from the project's verified sending domain.

**H5 — The Content-Security-Policy is inert.**
`api/index.js:71` sets CSP on **API JSON responses**. The HTML document is served by Vercel's static host and never receives that header, so `script-src 'self'` constrains nothing. Meanwhile `index.html:18` loads `https://www.anrdoezrs.net/am/101820027/impressions/page/am.js`, a third-party script with full DOM access that rewrites outbound links, with no Subresource Integrity. A CJ compromise is a full compromise of every visitor.

### Medium

**M6 — `supabaseAdmin` silently degrades to the anon client.**
`server/supabase.js:52` falls back to the anon client when `SUPABASE_SERVICE_ROLE_KEY` is missing. Because `guest_alerts` has RLS enabled with no policies (by design, per `supabase-schema.sql:91`), every guest subscribe silently fails with a 500. Authenticated queries return empty sets rather than erroring, because `auth.uid()` is null server-side. Broken functionality presenting as an intermittent server fault.

**M7 — Unbounded caches in `server/vehicleImages.js`.**
The `cache` Map (`:18`) has no size cap and no eviction, unlike `search.js` which caps at 500 entries. Worse, `imagePromises` (`:19`) entries are never deleted — one promise leaks per unique `make::model` key, forever. The key space is derived from user-controlled query params.

**M8 — No global error handler and no 404 handler.**
Malformed JSON bodies trigger `express.json`'s throw and fall through to Express's default HTML error page. The CORS rejection (`api/index.js:58`) throws `new Error('Not allowed by CORS')` down the same path, producing a 500 where a 403 is correct.

**M9 — The frontend trusts `localStorage` for auth state.**
`src/contexts/AppContext.tsx:44` hydrates `user` from `localStorage` and never revalidates against `/me`. An expired or invalid session renders a fully logged-in UI that 401s on every subsequent action.

**M10 — Database error text leaks to clients.**
`server/routes/supabase.js` returns `error.message` from Postgres directly to the client in six places, exposing constraint names, column names, and schema structure.

### Low / hygiene

- **L11** — `server/test-gemini.js` is committed and passes `GEMINI_API_KEY` in a URL query string, where it lands in proxy logs and shell history. Delete it.
- **L12** — `mockGuestSubscriptions` (`server/routes/supabase.js:37`) is written and never read. Dead code.
- **L13** — `getAuthToken`'s `.replace('Bearer ', '')` (`server/middleware/auth.js:14`) accepts bare tokens and strips only the first occurrence.
- **L14** — `/api/vehicle-image` (`api/index.js:198`) never applies the `vehicleError` validator defined immediately above it, so `make` / `model` are unbounded in length.

### Explicitly out of scope

- The JSON-LD injection guard at `src/components/ResultsList.tsx:162` is already correct (`textContent` + `<` escaping). No change.
- Dependencies are clean; no upgrades required.
- The "Blueprint & Radar" design-system work (commit `0c0afc8`) is not touched.

## Decisions

Two user-visible decisions were made before design:

1. **Fail closed, scoped to the account routes.** When Supabase is unconfigured in production, the account endpoints return 503. The serverless function does *not* refuse to boot: search, trims, quotes, vehicle images, and the AI endpoints require no database, and taking the whole product down over an accounts-only misconfiguration would be a worse outcome than the misconfiguration.
2. **Emergency patch first.** C1 is live. Phase 1 ships as one tight, deployable commit; Phase 2 follows as a separately reviewed set.

## Phase 1 — Emergency patch

Goal: make it impossible to authenticate against a server that cannot actually verify credentials, and stop the unbounded auth abuse surface. Deployable independently.

### 1.1 Mock mode becomes an explicit dev-only opt-in

`server/supabase.js` stops inferring mock mode from absent configuration.

```
isMockMode = !hasValidConfig
           && NODE_ENV !== 'production'
           && process.env.ALLOW_MOCK_AUTH === '1'
```

A new export, `accountsAvailable`, is true only when accounts can genuinely function:

```
accountsAvailable = (hasValidConfig && hasServiceRoleKey) || isMockMode
```

The service-role key is part of the condition because every authenticated write path in `routes/supabase.js` uses `supabaseAdmin`. This resolves **M6**: `supabaseAdmin` no longer falls back to the anon client in production. If Supabase is configured but the service key is absent, accounts are reported unavailable rather than silently half-broken.

When `hasValidConfig` is false in production, the module logs an explicit error (not a warning) naming the missing variables.

### 1.2 A gate ahead of every account route

A new `requireAccountsAvailable` middleware is mounted at the top of `server/routes/supabase.js`, before the public routes and before `requireAuth`. When `accountsAvailable` is false it returns:

```
503 { error: "Accounts are temporarily unavailable." }
```

**`POST /logout` is exempt from the gate.** It is a pure cookie-clearing operation that takes no credentials and reads no database. Gating it would strand the `cpf_token` cookie in browsers that hold a mock-issued session — the exact state §1.4 exists to clean up. Logout must always succeed.

Nothing outside `/api/supabase/*` is affected. This closes **C1**: with mock mode unreachable in production, there is no code path in which a credential-less login succeeds.

### 1.3 Rate limits on the auth surface

In `api/index.js`, using the already-present `express-rate-limit` and `trust proxy` configuration:

- `authLimiter` — 10 requests / 15 min / IP on `/api/supabase/login` and `/api/supabase/signup`.
- `subscribeLimiter` — 5 requests / hour / IP on `/api/supabase/price-alerts/subscribe`.
- `writeLimiter` — 60 requests / 15 min / IP across the rest of `/api/supabase`.

Limiters are mounted in `api/index.js` alongside the existing ones, keeping all rate-limit policy in one file. This closes **C2**.

Mock signup/login additionally require a non-empty password of at least 8 characters, so local development exercises the same validation shape as production.

### 1.4 Invalidate the fake sessions Phase 1 creates

Phase 1 causes a specific, foreseeable breakage: browsers currently hold a `carpartsradar-user` object in `localStorage` and a `cpf_token` cookie issued by mock logins. Once the gate ships, that state renders a logged-in UI whose every action 503s.

Two changes, both pulled forward from **M9** because Phase 1 is what creates the condition:

- `src/contexts/AppContext.tsx` revalidates against `GET /api/supabase/me` on boot when a cached user is present, and clears `localStorage` + context state on any non-2xx response. It also calls `logoutUser()` in that path so the stale `cpf_token` cookie is cleared server-side, not just the local copy. This actively logs out everyone holding a mock session.
- `src/components/Dashboard.tsx` renders an honest state on a 503 — accounts are temporarily unavailable, search still works — rather than a generic authentication error. `ApiError` already carries `status`, so no new plumbing is required.

### 1.5 Phase 1 verification

- `npm run build` passes.
- With `NODE_ENV=production` and no Supabase env: `POST /api/supabase/login` returns 503; `GET /api/search?...` returns 200.
- With `NODE_ENV=production` and no Supabase env: setting `cpf_token` to an arbitrary email and calling `GET /api/supabase/me` returns 503, not 200.
- With `NODE_ENV=production` and no Supabase env: `POST /api/supabase/logout` still returns 200 and clears the cookie.
- With `ALLOW_MOCK_AUTH=1` and `NODE_ENV=development`: the existing local flow works unchanged.
- 11 rapid `POST /api/supabase/login` attempts: the 11th returns 429.
- A browser holding a stale mock `carpartsradar-user` + `cpf_token` lands on the site logged out, with no console errors.

## Phase 2 — Hardening pass

Reviewed and committed separately from Phase 1.

- **H3** — Cap `/api/prices` at 20 ids per request (reject with 400 beyond that) and replace the unbounded `Promise.all` in `getCurrentPrices` with a bounded concurrency pool (limit 5). Mount the existing `searchLimiter` on the route.
- **H4** — Add an `escapeHtml` helper in `priceChecker.js` and apply it to `title`, `seller`, `part`, and the vehicle string. Validate that `listing.link` parses as a URL with an `https:` protocol and an `ebay.com` host before it is emitted into an `href`; omit the link entirely if it does not.
- **H5** — Move `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, and a document-appropriate CSP into `vercel.json`'s `headers` block so they apply to the HTML document. The CSP must accommodate the CJ script host, the Google Fonts hosts, and eBay's image CDNs. The CJ script itself is a deliberate, documented accepted risk (SRI is not possible for a script whose content CJ rotates); a comment in `index.html` records that decision.
- **M7** — Give `vehicleImages.js` the same LRU cap as `search.js` (500 entries) and delete `imagePromises` entries in a `finally` block.
- **M8** — Add a global Express error handler and a 404 handler. Convert the CORS rejection into a 403 rather than a thrown `Error`. Handle `express.json`'s `SyntaxError` explicitly, returning a 400 JSON body.
- **M10** — Stop returning `error.message` to clients in `routes/supabase.js`. Log the Postgres error server-side; return generic per-route copy.
- **L11** — Delete `server/test-gemini.js`.
- **L12** — Delete `mockGuestSubscriptions`.
- **L13** — Parse the `Authorization` header with an anchored, case-insensitive `^Bearer\s+` match; reject a bare token.
- **L14** — Apply `vehicleError` to `/api/vehicle-image`.

### Phase 2 verification

- `npm run build` passes.
- `/api/prices?ids=` with 21 ids returns 400.
- A listing title containing `"><script>` produces an email body with the sequence escaped; a `javascript:` link is omitted.
- `curl -H 'Origin: https://evil.example' https://.../api/search` returns 403, not 500.
- Malformed JSON to any POST returns a 400 JSON body, not an HTML error page.
- `curl -I https://carpartsradar.com/` shows the CSP and HSTS headers on the document.

## Post-deploy follow-up (not code)

Phase 1 leaves the Account feature returning 503 in production. To restore it, the following must be set in the Vercel environment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

and `server/supabase-schema.sql` must be run in the Supabase SQL editor. Until then, the 503 is the honest representation of what the site can offer — which is what it has actually been able to offer all along.
