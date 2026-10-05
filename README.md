# CarPartsRadar

Car-parts comparison website (React, TypeScript, Vite), shared API, and Expo mobile app in `mobile/`.

## Verification

- `npm test` — server, API-contract, and tooling tests.
- `npm run build` — web type-check and production bundle.
- `npm run lint` — web/server/tooling and mobile lint checks.
- `npm run check:web` — isolated browser workflows against the built website on desktop, phone, and tablet.
- `npm run test:e2e` — Chromium, Firefox, and WebKit workflows, recovery, and automated accessibility checks across three viewport sizes; build and install Playwright browsers first.
- `npm run typecheck:e2e` — strict type-check of the browser test harness.
- `npm run benchmark:web` — repeatable local web performance measurements; build first.
- In `mobile/`, run `npm test -- --runInBand` and `npx tsc --noEmit`.

See [performance methodology and commands](docs/PERFORMANCE.md), the [September 5 improvement report](docs/audits/2026-09-05-app-benchmark-improvements.md), and the [September 6 follow-up](docs/audits/2026-09-06-remaining-work.md). Browser checks and benchmarks use local fixtures, not production accounts or marketplace APIs.

The [September 22 SEO audit and release](docs/audits/2026-09-22-seo-release.md) documents the keyword map, crawl policy, guide templates, tests and measurement plan. After deployment, run `node scripts/check-seo.mjs` for read-only production checks. Edit editorial content in `scripts/editorial-content.mjs`, then run `npm run generate:editorial`; update each guide's `modified` date only for a meaningful content/link/schema change, not each build.

The [search-loading continuation](docs/audits/2026-09-06-search-loading-followup.md) documents the subsequent request/module overlap improvement and its separate validation.

The [reliability and validation continuation](docs/audits/2026-09-06-reliability-closure.md) records the latest recall, dialog, AI-guide and optional-history fixes, current benchmark results, and release checks that still require an authorized environment or physical device.

## Local browser validation

```powershell
npm ci
npx playwright install chromium firefox webkit
npm run build
npm run typecheck:e2e
npm run test:e2e
```

The tests start and close their own loopback fixture servers. No production account, API key, or long-running development server is needed. Do not run performance benchmarks concurrently with tests or builds. Automated browser emulation is not a substitute for physical iPhone/iPad, VoiceOver, or native build validation.

## Owner website analytics

The private `/admin` workspace shows daily visitor estimates, visits, page/screen
views, search attempts, retailer clicks, daily trends, a cumulative visit funnel,
traffic/device breakdowns, and engagement actions over 7, 30, or 90 Phoenix calendar
days. It never exposes individual visitors or customer information.

Backend setup in the existing CarPartsRadar deployment:

1. Review and apply `server/website-analytics-migration.sql` in the intended Supabase
   project. This creates a service-role-only event table and aggregate RPC; it does
   not modify customer tables. Keep the existing shared rate-limit migration enabled.
2. Set server-only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` (existing account configuration).
   On Vercel's single-edge deployment, set `TRUST_PROXY_HOPS=1` so the server
   hashes the trusted client address, not the proxy address. Do not trust forwarded
   addresses on a directly exposed development server.
3. Set `OWNER_EMAIL`, `OWNER_PASSWORD_HASH`, and `OWNER_SESSION_SECRET` on the server.
   Run `npm run owner:password` in an interactive terminal to create the scrypt hash
   without echoing the password. Generate a separate 32+ random-byte session secret.
   Never use a plaintext password or `VITE_*` for owner/server credentials.
   For the existing Vercel deployment, `npm run owner:configure -- --email EMAIL
   --project-dir "LINKED_PROJECT_DIRECTORY"` is a private interactive alternative.
   It hashes the entered password, creates independent session/analytics secrets,
   and sends only server configuration to the linked `carpart-finder` production
   project through the official Vercel CLI. Passwords are never echoed or logged;
   secret values use stdin, not process arguments. It refuses to overwrite existing
   variables, requires an already-authenticated Vercel CLI, and does not deploy code.
   Vercel's protected production secrets cannot be read back to copy another site's
   password hash; enter that same password privately if reusing it is intended.
4. Deploy the web and API together. Open `/admin` and sign in with the owner email
   and password. Ordinary shopper accounts cannot grant owner access.

Tracking is best-effort and independent of optional PostHog. It respects DNT/GPC,
excludes known bots and automated browser tests, and never delays searches. A visit
is a browser-tab session, renewed after 30 minutes without recorded activity or at
Phoenix midnight.
Visitors are DAILY keyed network/user-agent estimates, not identified people or
deduplicated people across the whole date range. The raw address/user-agent, full
URL, VIN, search text, account identity and uploaded photo are never stored in this
dataset. Shared search links imply the earlier funnel stages; the funnel reports
furthest progress, not a strictly ordered experiment or customer satisfaction.
Retailer clicks are not purchases. Tracking starts at enablement; historical traffic
cannot be reconstructed from unrecorded events. Missing configuration/storage is an
explicit unavailable state, never fabricated zero data. Rotate the owner session
secret to revoke all owner sessions.

`npm test` runs the actual migration and aggregation against an in-memory PostgreSQL
engine, plus owner-auth, route, privacy, idempotency and date-boundary tests. Browser
fixtures verify owner login/logout, range switching, empty/unavailable states, and
the public visit/search/details/store-click instrumentation without production data.

## Original web template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
