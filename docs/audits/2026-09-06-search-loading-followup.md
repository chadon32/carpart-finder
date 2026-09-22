# Search-loading follow-up — September 6, 2026

## Scope and implementation

This continuation was completed directly, without the orchestration skill or delegated agents. It preserves the existing dirty working tree and does not commit, push, deploy, change production data, or submit a release.

The earlier performance report identified a serial dependency: the direct-results route downloaded its screen and shared modules before mounting the effect that started `/api/search`. This unnecessarily added screen-loading latency to a slow provider response.

The small `ResultsRoute` now mounts outside the results screen's inner Suspense boundary and owns `usePartsSearch`. The screen module and search request can run concurrently. This does not eagerly download the complete results screen on the homepage, introduce a shared result cache, or issue a speculative duplicate search. React's development Strict Mode can still exercise effect setup/cleanup twice; the request-count tests use the production build.

Each request is keyed by year, make, model, trim, part, validated delivery ZIP, and retry revision. An identity change hides the preceding response immediately. Effect cleanup aborts the request, while a cancellation guard prevents an obsolete completion from publishing state. Existing client timeout, friendly-error, and fitment-contract checks remain in force. Results-view analytics still occur only after data and the results screen are available; price history remains deferred until successful results.

## File inventory

| File | Reason |
| --- | --- |
| `src/hooks/usePartsSearch.ts` | Own the keyed request lifecycle, cancellation, error state and retry in a small reusable hook. |
| `src/components/ResultsRoute.tsx` | Start search while the lazy results UI loads; retain persisted delivery ZIP and guard malformed stored ZIP types. |
| `src/App.tsx` | Mount the lightweight route instead of putting the whole search lifecycle behind a lazy boundary. |
| `src/components/ResultsList.tsx` | Consume the route's search state; remove the duplicate local fetch/state implementation while preserving UI and analytics behavior. |
| `src/components/FilterSheet.tsx` | Update its state-ownership comment to reflect the route/screen split; no behavior change. |
| `tests/web/search-lifecycle.spec.ts` | Hold the results module to prove early single-request behavior; exercise replacement ZIP, reload persistence and in-flight navigation cancellation. |
| `docs/PERFORMANCE.md` | Describe the added request-lifecycle regression checks. |
| `README.md` | Link this follow-up. |
| This report | Record evidence, limitations, and the exact scope of the continuation. |

## Verification

The preceding report remains historical evidence and is not silently relabeled as a result of this newer build.

- Production build and web TypeScript: passed.
- Web/server/tooling and mobile lint: passed.
- Browser harness TypeScript: passed.
- Server/API/tooling tests: 194 passed, zero failed/skipped. Log: `artifacts/benchmarks/2026-09-06/search-followup-unit.log`.
- Focused lifecycle matrix: 27 passed, zero failed/skipped. Log: `artifacts/benchmarks/2026-09-06/search-lifecycle-verified.log`.
- Complete browser matrix: **117/117 passed in one run**, zero failed/skipped, across Chromium, Firefox and WebKit at desktop/phone/tablet sizes. This includes 18 light/dark journey audits with 132 WCAG A/AA scene scans, keyboard/dialog checks, recovery and 200% text reflow. No unexpected application runtime errors were reported. Log: `artifacts/benchmarks/2026-09-06/search-followup-full.log`.
- Existing built-UI Chrome workflow check: passed desktop, phone and tablet, including reserved lazy-view layout and mobile dialog focus. Log: `artifacts/benchmarks/2026-09-06/search-followup-workflows.log`.
- Final diff whitespace check: passed. Test and benchmark processes/ephemeral fixture servers exited; no matching Node test/benchmark process remained.
- No native source changed in this continuation. The previous 126 mobile tests and iOS JavaScript export are not claimed as newly executed checks.

The first focused lifecycle run had two test-authoring failures: the test tried to edit ZIP a second time while the existing loading state intentionally hides filters. No duplicate request or application crash occurred. The revised test uses the actual supported workflow: commit ZIP, verify obsolete cards disappear while pending, release the response, and reload to verify persistence. In-flight cancellation is verified separately through real navigation and browser request-failure events. The resulting focused matrix passed 27/27 across all nine engine/viewport projects.

## New measured results

`artifacts/benchmarks/2026-09-06/parallel-search-v3.json` contains 45 cold samples (five per scenario/profile), using unchanged v3 fixtures, Chrome 152.0.7977.76, 4× CPU throttling, and 1.6 Mbps / 150ms simulated networking. No build or test suite ran concurrently with the benchmark. The original preserved baseline remains `before-v3.json`; `final-v3.json` is the previous follow-up build used for the incremental table below.

| Profile / scenario | Previous → new usable results (p75) | Improvement | New LCP (p75) |
| --- | ---: | ---: | ---: |
| Desktop results | 2,120 → 1,966 ms | 7.3% | 1,992 ms |
| Phone results | 2,084 → 1,969 ms | 5.5% | 1,976 ms |
| Tablet results | 2,091 → 1,957 ms | 6.4% | 1,640 ms |
| Desktop delayed results | 2,752 → 2,539 ms | 7.7% | 2,544 ms |
| Phone delayed results | 2,718 → 2,513 ms | 7.5% | 2,516 ms |
| Tablet delayed results | 2,729 → 2,529 ms | 7.3% | 1,656 ms |

Homepage form readiness changed by approximately −1% to +1.2% across profiles, essentially unchanged in this small sample. Initial JavaScript gzip increased by 315 bytes versus the preceding build (94,983 → 95,298, +0.33%). This small route lifecycle overhead buys concurrent data loading without eagerly loading the full results screen. All CLS measurements remain within 0.1, and all ordinary results/home LCP measurements remain within 2,500ms. Desktop/phone delayed-results LCP still exceeds that target by 44ms/16ms; this is not a pass just because it is close.

The strict unchanged 15% comparison against the original baseline still exits **1**, now with **one** relative flag: desktop ordinary-results long-task count is 6 → 7 (+16.7%). Aggregate main-thread time for that scenario fell from 1,365.46 to 1,233.48ms (−9.7%). The two earlier loopback-TTFB flags did not recur in this measurement; the application change is not claimed to fix local-server timing variation. Zero enforceable absolute-budget regressions were observed. No samples were discarded and no threshold was relaxed.

One raw desktop delayed sample shows the intended mechanism directly: the lazy results module starts around 1,049ms and finishes around 1,331ms; `/api/search` starts around 1,231ms, before that module completes and well before the results UI appears around 1,640ms. Readiness still includes rendering cost, not only network time. The same sample's cards are observed at 2,525ms. These are controlled local measurements, not a claim about production latency or conversion.

New build fingerprint: `sha256:3241de184e770d39c3ecc2681044390a95cd85b9c9f622fcb6211f73f6af6a5f`. Benchmark log and nine screenshots are in `parallel-search-v3.log` and `parallel-search-shots/` beside the JSON. Desktop and phone delayed-result screenshots were visually inspected.

### Remaining performance work

- **P2:** Profile the extra desktop long task and result rendering further; retain both the relative flag and the slightly missed delayed LCP budgets as open findings.
- **P2:** Obtain authorized field measurements with actual fonts, images, providers, and approved affiliate scripts before making production performance claims.

## Release boundaries

Physical iPhone/iPad testing, native signing/TestFlight, authorized staging account deletion, live provider/AI accuracy, and approved affiliate-attribution checks are not established by local fixtures. The existing CJ tag and privacy/consent behavior are unchanged. No claim of complete accessibility, security, production readiness, or a 10/10 product score is made.
