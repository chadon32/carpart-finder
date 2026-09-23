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
