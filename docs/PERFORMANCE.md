# Web benchmark

`npm run benchmark:web` measures the already-built `dist` bundle with Chrome and does not rebuild it. By default it starts an ephemeral `127.0.0.1` static server, serves compressible responses with gzip, and provides a tooling-only deterministic API fixture for a 2020 Toyota Camry LE / Brake Pads search. It never starts the application API or contacts a real provider.

The fixture supports the health, vehicle-selection, image, search, and price-history requests used by three scenarios: home, direct results, and direct results with 800 ms of server delay. Results include a real first-party WebP (the same test image on both cards), exercising transfer, decoding, and layout without live inventory. All off-origin browser requests are blocked, and external scripts/styles are removed from the served benchmark HTML. This deliberately excludes analytics, affiliate scripts, email, marketplace images/providers, remote fonts, and live backends; the report labels this as `deterministic-fixture`.

Run a five-sample report:

```powershell
npm run benchmark:web -- --output=benchmark-report.json
```

Use one to twenty cold runs, a specific Chrome executable, or optional screenshots (taken after each scenario's measured window):

```powershell
npm run benchmark:web -- --runs=5 --chrome="C:\Program Files\Google\Chrome\Application\chrome.exe" --screenshots=artifacts/benchmarks/screenshots
```

Chrome is selected from `CHROME_PATH` first, then common platform locations. `--url=http://127.0.0.1:4173` is allowed only for a deliberately supplied loopback server and reports `local-external-server`; remote URLs are rejected. That mode is not deterministic and still blocks third-party requests.

For a guarded comparison, provide a report produced by this tool:

```powershell
npm run benchmark:web -- --baseline=baseline.json --max-regression=15 --check --output=candidate.json
```

Reports retain every raw sample and include min, median, p75, and max. The network profile is 1.6 Mbps down / 750 Kbps up / 150 ms latency and CPU is throttled 4× for desktop, mobile, and tablet. The report records Chrome, Node, OS, Git SHA/dirty state, and a hash of the existing build artifacts. Initial module scripts/modulepreloads and CSS are measured separately with raw and gzip sizes; all JS chunks are also reported.

Schema v3 additionally retains LCP candidate element/text/image attribution and a resource waterfall for each run. `usableContentMs` records when the browser check observes the enabled vehicle form or rendered listing cards; it is a synthetic readiness measurement, not INP or a claim that every image has painted. JavaScript transfer includes all `.js` resource URLs, including module preloads. V2 reports are intentionally incompatible: capture a fresh baseline with the same harness. `--dist=artifacts/benchmarks/baseline-dist` measures a preserved build directory instead of `dist`, so a before/after comparison does not require resetting user code.

`--check` rejects a baseline with a different schema, mode/fixture, scenarios, profiles/viewports, conditions, or Chrome major version. Missing required p75 metrics are also rejected. It fails p75 regressions above `--max-regression`. It reports CLS ≤ 0.1 and LCP ≤ 2500 ms separately as `withinBudget`; those become enforceable only when the compatible baseline already achieves the budget (`passesEnforced` is otherwise `null`), avoiding a misleading pass/fail claim for an unattainable or absent baseline. Output paths use exclusive creation and will not overwrite a previous report.

FCP/LCP must be valid positive browser entries; HTTP navigation failures, runtime console errors, and unexpected local fixture request failures fail the run rather than being dropped. CLS uses the Core Web Vitals session-window algorithm (one-second gap, five-second maximum session) and is reported to four decimals. Results describe synthetic, cold-cache fixture behavior only, not live-provider latency, third-party cost, real-user data, or production performance.

## Built-UI regression checks

```powershell
npm run build
npm run check:web
```

The browser check uses an isolated Chrome profile and local fixtures. It covers desktop, phone, and tablet vehicle selection, invalid input, linked labels, ArrowUp/Escape/Enter behavior, part search, results refresh, readable listing titles, page overflow, deferred filter loading, mobile-dialog keyboard focus and restoration, and the reserved loading layout. Screenshots are written to `benchmark-shots/workflows/` after finite entrance animations finish. The checks do not create accounts, send alerts, or open affiliate links. Both the browser and ephemeral server close on success or failure.

## Cross-browser and accessibility checks

For the cross-browser suite, install browser runtimes with `npx playwright install chromium firefox webkit`, then run `npm run typecheck:e2e` and `npm run test:e2e`. Nine projects cover Chromium, Firefox, and WebKit at desktop (1365×768), phone (390×844), and tablet (834×1112) sizes. Firefox uses responsive viewport testing, not unsupported mobile emulation. `--project=chromium-phone` selects a focused run. HTML results, failure screenshots, traces, and axe evidence live under `artifacts/benchmarks/e2e/`.

The suite exercises keyboard navigation, history/refresh, local watchlists, comparison/details/filters, clipboard success/denial, and controlled empty/error/slow/offline responses. Axe checks WCAG 2.0/2.1 A/AA rules in light and dark modes after finite animations settle; failures remain failures. Automated axe results do not establish complete WCAG conformance or screen-reader usability. Large-text and reduced-motion checks supplement those scans.

Search-lifecycle tests hold the lazy results module while asserting that exactly one production-build search has already started. They also verify ZIP replacement/persistence and navigation cancellation. The lightweight route must commit outside the results screen's inner Suspense boundary; putting the request effect back inside the lazy screen would recreate the measured code-to-request waterfall.

Optional price history lives in a keyed child card so an empty/short history does not rerender the complete results list. Browser tests cover delayed history while a comparison remains selected, unavailable history, vehicle-health cache/response validation and retry, mileage persistence, recall/guide light/dark contrast, safe guide markup and typography, guide timeout/cancellation, and dialog focus across the phone/desktop breakpoint. Listing cards and desktop dialog panels do not translate into place while their controls are already clickable.

## Interpreting comparisons

An experimental manual icon/React grouping was rejected: it reduced results requests but added an initial request and gzip bytes. Rolldown deliberately creates a separate runtime chunk for manual groups to preserve initialization order ([bundler documentation](https://rolldown.rs/in-depth/manual-code-splitting#why-there-s-always-a-runtime-js-chunk)). The final configuration retains automatic splitting and existing lazy views, rather than adding a dependency or overriding runtime behavior to force a benchmark score.

Run benchmarks without builds, unit tests, or other CPU-intensive tasks in parallel. Keep the same browser, build environment, fixture, and throttling. Five samples show variation but are not field data or a statistical guarantee. Do not silently increase regression thresholds to get a green result. Inspect changed content and the raw samples when a gate fails: for example, removing a flashing footer can change which element is the largest-contentful-paint candidate even though layout stability improves.

`--check` can flag a one-task increase in `longTaskCount` when the baseline has very few tasks. That is deliberately visible for investigation, not proof of a perceptible slowdown. Treat unachieved absolute budgets as remaining work, even when no achieving baseline exists to enforce them. The browser report is not a Lighthouse, accessibility, security, or native-app startup score.

Native app checks run separately in `mobile`: `npm test -- --runInBand` and `npx tsc --noEmit`. A local `npx expo export --platform ios` verifies the JavaScript/asset bundle, not device startup speed, native compilation, signing, or TestFlight readiness. The test-only Babel dynamic-import transform allows mocking lazy native modules without changing Metro's production imports; see the [Babel transform documentation](https://babeljs.io/docs/babel-plugin-transform-dynamic-import).

The native recall contract also requires the shared source to be visible to Metro and included in EAS archives. `mobile/metro.config.js` and the two explicit recall-contract exceptions in `.easignore` implement those boundaries. Do not treat passing TypeScript/Jest checks as proof that an external source file can be bundled or is present in an upload.
