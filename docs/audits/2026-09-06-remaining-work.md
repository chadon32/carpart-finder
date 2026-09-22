# Remaining app and benchmark work — September 6, 2026

## Scope

Follow-up to the September 5 app/benchmark improvement report. The existing dirty working tree was preserved. This pass changed local web UI, tests, and measurement tooling. It did not commit, push, deploy, submit to Apple, access production accounts/data, send alerts, or open affiliate links. Native source was not changed in this follow-up; its existing changes were regression-tested.

The orchestration skill separated bounded browser-harness work and read-only performance/CJ investigation. The lead reviewed the resulting files and personally executed integration checks. Production/privacy decisions were not delegated or silently changed.

## Fixes and root causes

1. **Clipboard reliability.** The Share action previously displayed success without awaiting the browser's clipboard permission/result. It now reports success only after completion, gives a manual recovery instruction on denial/unavailability, ignores overlapping taps, and cleans up its timer on unmount.
2. **Honest comparison totals.** The comparison table treated missing shipping as zero and described an incomplete amount as total out-of-pocket. It now reuses the existing known-total calculation, says shipping is shown at checkout, and leaves unknown totals unavailable. Known totals explicitly exclude tax. No ranking or pricing policy was changed.
3. **Desktop dialog isolation.** A focus trap alone did not make the background unavailable to assistive technology. Desktop dialogs now render outside the application root, make that root inert while open, and restore the previous inert/scroll/focus state on close. Mobile continues to use the existing Vaul/Radix dialog architecture.
4. **Contrast and semantics.** Corrected small-text contrast in results, shipping/rating badges, comparisons, details, vehicle selection, guest account controls, and progress labels. Added the missing darkest brand token used by existing dark-mode backgrounds. Mobile progress steps have text alternatives; the horizontally scrolling feature region is keyboard-focusable.
5. **Large-text reflow.** At 320px with a 200% root font size, nested relative padding and non-wrapping headers compressed content into tiny columns. Narrow-screen gutters and card padding now remain stable, headers/sidebar content wrap, and the footer/progress indicator fit. Tests check actual heading/input widths as well as page overflow. Final Firefox inspection measured a 246px heading and 212px email field within a 320px page.
6. **Rendering work.** Removed page-wide/hero opacity entrances and repeated skeleton shimmer. Primary text is visible on first paint; one radar/status still communicates loading. Existing on-demand filters, dialogs, guides, and native lazy modules remain intact.
7. **Better evidence.** Added Chromium/Firefox/WebKit browser projects, controlled recovery tests, light/dark axe scans, clipboard/rapid-tap coverage, and an image/slow-API benchmark with raw paint attribution and readiness measurements.

## Verification

- Web production build and TypeScript: passed.
- Server/API/tooling: 194 tests passed, zero failed/skipped.
- Web/server/mobile lint and browser-harness lint/type-check: passed.
- Existing Chrome built-UI workflow check: passed at desktop, phone, and tablet sizes.
- Native app: 29 Jest suites / 126 tests passed; TypeScript passed.
- iOS JavaScript/asset export: passed, 1,227 modules and approximately 2.7 MB Hermes bundle. This does **not** verify native compilation, code signing, startup timing, physical-device behavior, or TestFlight distribution.
- Automated tests use fresh browser contexts, block off-origin requests, and run against an ephemeral loopback fixture. No real account, email, marketplace API, AI service, or paid action is used.

### Browser matrix

All **90 distinct browser/profile cases** were verified on the final UI build; none was skipped. The matrix covers ten tests across Chromium, Firefox, and WebKit at desktop, phone, and tablet sizes. Eighteen light/dark journey audits passed their WCAG 2.0/2.1 A/AA scans, including dialogs (seven scenes per desktop/tablet audit and eight per phone audit). No unexpected application runtime errors were observed in those successful cases.

Execution history is intentionally explicit:

- The full final-build run passed 88/90. Two Firefox watchlist cases missed their first click after automatic scrolling aligned the button at the viewport's top edge during sticky-header movement. The trace recorded a click at y=22, and the watchlist remained unchanged. Moving-header interference is the inferred cause; the centered real-pointer reruns below validate the interaction without bypassing click handlers.
- The test now scrolls that target to the center before a real pointer click, retaining actionability checks and behavioral assertions. The complete affected nine-project interaction suite then passed **9/9**; Firefox phone additionally passed **five consecutive repetitions**.
- An earlier run exposed an incorrect comparison-test assumption: columns follow selection order, not result order. Expected headings and known/unknown shipping totals now assert the correct order. All nine comparison cases passed on the final build.
- Earlier axe findings were fixed in application code. Theme audits were split into independent tests to avoid packing fourteen scans into one 30-second test. No contrast rule was disabled, no failing test skipped, and no benchmark limit was loosened.

Evidence: `artifacts/benchmarks/2026-09-06/browser-reflow-final.log`, `interactions-verified.log`, and `firefox-repeat.log`. Failed traces remain under `artifacts/benchmarks/e2e/verified-reflow-20260906/`; successful focused runs have separate output directories. Final screenshots are under `benchmark-shots/workflows/` and `artifacts/benchmarks/2026-09-06/firefox-large-text-alert.png`.

## Benchmark method and interpretation

Schema v3 includes a real first-party WebP fixture, an 800ms delayed-search scenario, LCP element attribution, resource timings, and `usableContentMs`. Readiness means the browser observed the enabled vehicle form or rendered listing cards; it is not INP or an assertion that all images have painted.

The preserved pre-change build is `artifacts/benchmarks/2026-09-06/baseline-dist`; its baseline report is `before-v3.json`. Five cold runs per scenario/profile use Chrome 152, 4× CPU slowdown, and 1.6 Mbps / 150ms simulated networking. External fonts, analytics, CJ, live providers, and marketplace images are excluded. The same expanded harness measures both builds; September 5 schema-v2 numbers are not directly compared.

Paint attribution supports the explanation for the earlier desktop/phone results LCP increase: reserving layout space removed the transient footer candidate. The v3 results explanation becomes the largest contentful element on those profiles; on tablet the disclosure can remain the LCP candidate. This is evidence of a changed paint candidate, not proof that every timing change is harmless. Usable-results timing accompanies LCP rather than asserting that one paint metric proves the entire flow faster.

A manual icon/React chunk-group experiment was rejected. It reduced results requests but added an initial request and gzip bytes. The bundler deliberately emits a separate runtime for manual groups ([Rolldown documentation](https://rolldown.rs/in-depth/manual-code-splitting#why-there-s-always-a-runtime-js-chunk)). Automatic splitting is retained; no experimental runtime override or extra bundler dependency remains.

### Final measured results

Both reports used **Chrome 152.0.7977.76**. Each contains 45 measured cold-load samples. Values below are p75; smaller is better. Differences of a few dozen milliseconds should not be treated as guaranteed field gains.

| Profile / scenario | LCP before → after | Usable content before → after | Main-thread task time change |
| --- | ---: | ---: | ---: |
| Desktop home | 1,780 → 1,424 ms | 1,634 → 1,629 ms | −15.4% |
| Phone home | 1,764 → 1,420 ms | 1,611 → 1,634 ms | −13.1% |
| Tablet home | 1,780 → 1,416 ms | 1,614 → 1,633 ms | −14.9% |
| Desktop results | 2,184 → 2,124 ms | 2,166 → 2,120 ms | −6.5% |
| Phone results | 2,132 → 2,088 ms | 2,126 → 2,084 ms | −5.3% |
| Tablet results | 1,680 → 1,628 ms | 2,176 → 2,091 ms | −10.7% |
| Desktop delayed results | 2,776 → 2,760 ms | 2,773 → 2,752 ms | −6.6% |
| Phone delayed results | 2,760 → 2,720 ms | 2,759 → 2,718 ms | −10.0% |
| Tablet delayed results | 1,688 → 1,620 ms | 2,795 → 2,729 ms | −15.1% |

Homepage LCP is 19.5–20.4% earlier; form readiness is essentially unchanged. Results readiness improved modestly in this sample. Initial JavaScript gzip is effectively unchanged: **94,977 → 94,983 bytes**. Results JavaScript transfer increased **115,929 → 116,657 bytes** (+0.6%), and results resource count increased 19 → 20. Homepage resource count remains six. CLS remains zero on home and 0.0006 / 0.0032 / 0.0008 on desktop / phone / tablet results.

**The strict `--check` gate did not pass.** It exited 1 with three relative flags above the unchanged 15% threshold:

- Desktop results long-task count: 6 → 7 (+16.7%), despite 6.5% lower aggregate main-thread task time.
- Phone home loopback TTFB: 5.3 → 6.6 ms (+24.5%; 1.3ms absolute).
- Phone results loopback TTFB: 5.5 → 6.4 ms (+16.4%; 0.9ms absolute).

These small-count/local-timing flags are not ignored or mislabeled as a pass. There were zero enforceable absolute-budget regressions, but delayed desktop/phone results still miss the absolute 2,500ms LCP target (2,760 / 2,720ms); their baselines also missed it. All other LCP scenarios and all CLS budgets pass. Slow-result timing remains P2 work, not a completed performance guarantee.

Final build fingerprint: `sha256:d6ece2844dbfb0b776229c7d729339e934d44db5c6ac60f3a7158c95033ed71c`. Raw reports: `artifacts/benchmarks/2026-09-06/before-v3.json` and `final-v3.json`. The intermediate `candidate-v3.json` records the rejected chunk-group experiment; it is not the shipped local configuration. Final measurement screenshots are under `artifacts/benchmarks/2026-09-06/final-shots/`.

## Files changed in this follow-up

These are this pass's changes, not every earlier modification shown by Git status.

| File | Reason |
| --- | --- |
| `src/App.tsx` | Immediately visible primary content, keyboard-scrollable feature region, stable mobile gutters/footer reflow, trust-label contrast. |
| `src/components/ResultsList.tsx` | Awaited clipboard result, rapid-tap guard/timer cleanup, quieter skeletons, wrapping result/sidebar layout. |
| `src/components/ComparisonModal.tsx` | Existing known-total helper, explicit unknown shipping and pre-tax totals, contrast. |
| `src/components/Modal.tsx` | Desktop portal, background inert state, cleanup/restoration. |
| `src/components/StepIndicator.tsx` | Correct current-step semantics, mobile text alternatives, contrast and narrow layout. |
| `src/components/CarSelector.tsx` | Selected vehicle type and trim contrast in dark mode. |
| `src/components/Dashboard.tsx` | Guest account separator/link contrast; no authentication changes in this pass. |
| `src/components/ListingCard.tsx` | Shipping/rating/price contrast and stable narrow-screen padding. |
| `src/components/PartDetailModal.tsx` | Header, image placeholder, price, shipping, and evidence contrast. |
| `src/components/PriceAlertCard.tsx` | Wrapping header and stable narrow-screen padding; no subscription behavior change. |
| `src/index.css` | Missing brand-950 token, dark eyebrow/tab contrast, remove unused shimmer definition. |
| `package.json` | Playwright/axe development dependencies, browser-test/typecheck commands, and browser tests in normal lint coverage. |
| `package-lock.json` | Lock the added browser-test dependencies; preserve existing unrelated dependency updates. |
| `playwright.config.ts` | Nine engine/viewport projects, local artifacts, failures/traces, bounded workers. |
| `tsconfig.e2e.json` | Strict type-checking for browser test infrastructure. |
| `tests/web/helpers/fixture.ts` | Disposable local server, fresh contexts, off-origin blocking and runtime-error assertions. |
| `tests/web/helpers/journey.ts` | Shared user-level keyboard/navigation/dialog assertions. |
| `tests/web/helpers/a11y.ts` | WCAG 2.0/2.1 A/AA scans after finite animations, raw violation evidence, no rule exclusions. |
| `tests/web/clipboard.spec.ts` | Success, denied permission, and overlapping taps. |
| `tests/web/comparison.spec.ts` | Unknown shipping versus known pre-tax totals in selected column order. |
| `tests/web/interactions.spec.ts` | Local watchlist, filters, details, comparison and desktop inert cleanup. |
| `tests/web/recovery-and-a11y.spec.ts` | Empty/error/slow/offline recovery, light/dark audits, large text and reduced motion. |
| `tests/web/workflows.spec.ts` | Vehicle/part keyboard flow, invalid/blank input, labels, refresh and Back/Forward. |
| `scripts/benchmark-web-lib.mjs` | Schema v3, preserved-build option, bounded opt-in image/delay fixtures, readiness metric validation. |
| `scripts/benchmark-web.mjs` | Image/slow scenarios, LCP candidates, resource waterfall, all-JS transfer accounting and progress. |
| `scripts/benchmark-web.test.mjs` | Preserved-build argument and image/delay fixture regression tests. |
| `docs/PERFORMANCE.md` | Updated methodology, limits, reproducible commands and interpretation. |
| `README.md` | Discoverable browser test setup and report links. |
| This report | Scope, root causes, evidence, exact file inventory and external release checks. |

## Remaining release checks and risks

- **P0:** No newly identified P0 issue in the exercised local scope. This is not a complete security or production audit.
- **P1 — physical iOS release validation:** Use a physical iPhone and iPad for VoiceOver, Dynamic Type, camera permission/denial, keyboard, navigation, account/deletion flow using an authorized disposable account, and poor connectivity. Then compile/sign and test the intended build through TestFlight. Windows browser emulation and JS export cannot establish these results.
- **P2 — production performance and attribution:** Real-user timings, production fonts/images, provider latency, AI accuracy, and affiliate attribution are unverified. Do not infer conversion or revenue from fixture results.
- **P2 — remaining benchmark targets:** The relative gate has the three flags listed above. Slow desktop/phone results exceed the absolute LCP target. Further work should profile the direct-results module/request waterfall and verify improvements against the same harness without weakening limits or duplicating live search requests.
- **P2 — CJ loading:** The existing parser-blocking tag is unchanged. Local investigation found no app code relying on a synchronous CJ API, but did not obtain CJ confirmation that async/defer preserves rewriting/attribution. Obtain the current approved snippet or support confirmation before modifying it; a permitted tracking test is also needed. [CJ Publisher Tag documentation](https://developers.cj.com/docs/publisher-site-tracking/publisher-tag-overview).
- **P3 — coverage:** Axe does not prove complete accessibility or screen-reader usability. These are core-journey checks, not every editorial route, authenticated state, image upload, AI report, or third-party flow. Firefox phone/tablet projects emulate responsive viewports, not a physical mobile Firefox engine.

### Next five highest-value steps

1. Physical iPhone/iPad accessibility and camera/keyboard QA on the intended release build.
2. Authorized staging account lifecycle test, including irreversible deletion and session expiry, with explicit disposable test data.
3. Measure production Core Web Vitals and provider/network timing without changing consent/privacy behavior.
4. Obtain CJ-approved loading guidance and validate affiliate rewriting/attribution in an approved environment.
5. Extend fixture browser coverage to vehicle-health/AI report and authenticated flows, and configure CI after the local changes are reviewed for a commit.
