# App and benchmark improvements — September 5, 2026

## Scope and outcome

This pass improved the existing dirty working tree in place. It did not commit, push, deploy, submit a build, change accounts, send alerts, or modify production data. Earlier uncommitted work is preserved and is not claimed as work completed in this pass.

### Verified fixes

- **Mobile search correctness:** results and failures are tied to the full vehicle/part/ZIP key. Old shipping estimates disappear immediately on a ZIP change. Same-search refresh failures retain clearly marked recent results. Obsolete results and history cannot overwrite current state even when a request ignores cancellation.
- **Mobile photo search:** a visible 44px Search listings action uses existing validation and normalization. Identification is single-flight from permission request onward; camera failures recover; search controls cannot navigate away while identification is running.
- **Mobile accessibility:** listing descriptions announce shipping cost, free shipping, or unavailable shipping. The price row wraps. Results, the shipping ZIP field, and overseas toggle have useful accessibility metadata.
- **Web forms:** visible vehicle labels are associated with controls; dropdowns expose accessible names, clear inactive option references, and correctly move to the last option on ArrowUp. Blank part searches prevent submission and show guidance.
- **Web diagnostic correctness:** generic vehicle dropdowns no longer offer hard-coded part guesses for OBD codes. The dedicated Error Code (OBD-II) workflow remains available.
- **Web navigation:** deliberate vehicle/part/search navigation resets scroll and moves focus into the main content. The separate browser Back/Forward handler is preserved.
- **Web layout:** loading views reserve content space so the footer no longer flashes and jumps away. Listing title/price rows wrap according to available card width; tablet titles no longer collapse into one-character columns.
- **Web dialogs/performance:** FilterSheet and its shared dialog dependency load on demand. Mobile sheets receive keyboard focus without opening the software keyboard and restore focus when dismissed.

## Verification

- Web production build: passed.
- Root tests: 192 passed, 0 failed.
- Mobile tests: 29 suites, 126 tests passed, 0 failed.
- Web/mobile lint and TypeScript: passed.
- Built-UI browser checks: passed on Chrome desktop 1365×768, phone 390×844, and tablet 834×1112.
- Screenshots inspected for each viewport and the mobile filter sheet. A tablet title-width defect found during visual review was fixed and the workflow check now guards it.
- Local iOS JavaScript/asset export: passed (1227 modules, approximately 2.7 MB Hermes bundle). This is not a signed native build.
- Earlier test attempts exposed a test-only dynamic-import limitation and async-test waiting mistakes; those were corrected. Cold-transform timeout attempts were rerun without raising test timeouts. No failing test was skipped or disabled.

## Benchmark results

Five cold samples per scenario and viewport, Chrome 152 on the same Windows machine, 4× CPU throttle and the same simulated network. Values below are p75. Every scenario completed with valid paint entries and no runtime/local-request errors. External fonts, affiliate/analytics scripts, images and live providers were excluded; these are synthetic fixture measurements, not production claims.

| Metric | Before | Final | Interpretation |
| --- | ---: | ---: | --- |
| Results transferred data (all viewports) | 159,546 B | 139,305 B | 12.7% less downloaded data. |
| Results script-initiated transferred data | 132,016 B | 111,728 B | 15.4% lower; filter/dialog code is deferred until opened. |
| Desktop results CLS | 0.1715 | 0.0006 | Substantially steadier loading. |
| Phone results CLS | 0.3849 | 0.0032 | 99.2% lower layout shift. |
| Tablet results CLS | 0.0708 | 0.0008 | Substantially steadier loading. |
| Desktop home LCP | 1,732 ms | 1,748 ms | Essentially unchanged in this sample. |
| Phone home LCP | 1,824 ms | 1,756 ms | Modest improvement, not a guaranteed field gain. |
| Tablet home LCP | 1,724 ms | 1,820 ms | Slower in this sample. |
| Desktop results LCP | 1,220 ms | 2,140 ms | Regression flagged; requires content/paint attribution. |
| Phone results LCP | 1,236 ms | 2,128 ms | Regression flagged; requires content/paint attribution. |
| Tablet results LCP | 1,748 ms | 1,704 ms | Modest improvement. |

Initial JavaScript gzip is effectively unchanged: 95,080 → 94,977 B. Total JavaScript across **all** lazy chunks increased slightly: 194,595 → 195,408 B. The improvement is less code fetched on the results path, not a large reduction in the whole application.

All six scenarios meet the report's absolute p75 LCP ≤ 2,500 ms and CLS ≤ 0.1 targets. **The strict relative regression gate nevertheless failed**, with seven flags:

- Desktop home TTFB: 5.0 → 5.8 ms (+16%; sub-millisecond absolute difference).
- Desktop results LCP: 1,220 → 2,140 ms (+75.4%).
- Desktop results long-task count: 6 → 7 (+16.7%).
- Phone results LCP: 1,236 → 2,128 ms (+72.2%).
- Tablet home script duration: 224.37 → 261.16 ms (+16.4%).
- Tablet results long-task count: 6 → 7 (+16.7%).
- Tablet results long-task duration: 701 → 819 ms (+16.8%).

The large layout shift was directly attributed to the footer flashing at y=493 on the phone and then disappearing below the viewport. Reserving loading space fixes that defect, but also changes the visible content available to the LCP calculation. That is a likely explanation for the desktop/phone paint-metric change, not proof that all timing regressions are harmless. Further paint attribution and real-device measurements remain necessary. Thresholds were not relaxed and failing samples were not discarded.

Raw reports: `artifacts/benchmarks/before-2026-09-05.json` and `artifacts/benchmarks/final-2026-09-05.json`. The intermediate `after-2026-09-05.json` precedes the tablet title fix and is retained only for traceability. Regenerate with the commands in `docs/PERFORMANCE.md`; output reports are never silently overwritten.

## Files changed in this pass

| File | Reason |
| --- | --- |
| `src/App.tsx` | Stable loading layout and explicit-navigation scroll/focus reset. |
| `src/components/CarSelector.tsx` | Associate Make and Trim labels with their controls. |
| `src/components/Combobox.tsx` | Accessible naming, labels, keyboard correction, safe option references, timer cleanup, removal of generic OBD guesses. |
| `src/components/ResultsList.tsx` | Lazy-load filters with a visible loading state. |
| `src/components/ListingCard.tsx` | Prevent title/price compression in narrow result columns. |
| `src/components/Modal.tsx` | Mobile-sheet focus entry and restoration. |
| `mobile/src/app/results.tsx` | Keyed results/errors, stale-request protection, labeled controls, built-in list refresh. |
| `mobile/src/app/part-picker.tsx` | Visible search action, guarded photo flow, camera recovery. |
| `mobile/src/components/ListingCard.tsx` | Shipping in accessible name and wrapping cost row. |
| `mobile/src/app/__tests__/results-performance.test.tsx` | ZIP, refresh, cancellation, out-of-order and history regression coverage. |
| `mobile/src/app/__tests__/part-picker.test.tsx` | Photo-to-search, validation, keyboard, failure and busy-state tests. |
| `mobile/src/components/__tests__/ListingCard.test.tsx` | Known, unknown and free shipping accessibility tests. |
| `mobile/babel.config.js` | Transform dynamic imports only in Jest; preserve production Metro behavior. |
| `mobile/package.json` | Add the test-only Babel transform dependency. |
| `mobile/package-lock.json` | Lock that added development dependency; preserve prior dependency updates. |
| `scripts/benchmark-web.mjs` | Isolated browser measurement, profiles, validation, comparison and report lifecycle. |
| `scripts/benchmark-web-lib.mjs` | Fixtures, asset sizes, statistics, CLS calculation and regression/budget logic. |
| `scripts/benchmark-web.test.mjs` | Tooling unit tests, including fresh-checkout operation and server cleanup. |
| `scripts/check-web-workflows.mjs` | Reusable real-browser UI regression checks and screenshots. |
| `package.json` | Add `check:web`; preserve existing scripts and dependencies. |
| `.gitignore` | Keep generated benchmark reports, exports and screenshots out of source control. |
| `docs/PERFORMANCE.md` | Benchmark instructions, limitations and interpretation. |
| `README.md` | Discoverable verification commands and links. |
| This report | Evidence, scope, changes and remaining limitations. |

## Remaining work and limits

- **P1 — release validation:** test on physical iPhone/iPad hardware, including camera permission prompts, VoiceOver, dynamic type, native keyboard, navigation and poor connectivity. Windows-based export does not establish native compilation, signing or TestFlight readiness.
- **P2 — performance evidence:** verify real-user performance with production fonts, listing images and third-party scripts, and profile the actual largest visible results content. Local fixture numbers do not measure provider latency or conversion.
- **P2 — test breadth:** the browser checks cover the modified core journey, not a complete Firefox/WebKit, screen-reader, color-contrast or all-route audit. Authentication, deletion, checkout/affiliate completion and AI accuracy were not exercised against production.
- **P3 — benchmark breadth:** add an observed time-to-usable-results metric and first-party image fixtures, then establish a new comparable baseline. Do not compare those expanded scenarios directly with this run.

Next five highest-value steps: physical-device QA; production performance attribution; representative image/slow-API benchmarks; Firefox/WebKit workflow coverage; focused screen-reader and large-text testing.
