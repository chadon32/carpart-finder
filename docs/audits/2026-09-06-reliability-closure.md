# Reliability and validation continuation — September 6, 2026

## Scope

Direct local work, without orchestration or delegated agents. The existing dirty working tree is preserved. No commit, push, deployment, native submission, production-data access, account deletion, email, or affiliate transaction was performed.

This report continues the earlier search-loading report; it does not relabel earlier measurements as current results. Local fixtures establish application behavior under controlled conditions, not live-provider accuracy, App Store acceptance, complete accessibility, or production security.

## Changes and root causes

1. **Optional price history:** its state/effect previously lived in the complete results screen. Normal empty histories caused unnecessary whole-screen renders. A small, search-keyed `PriceHistoryCard` now owns the abortable request and only renders with enough observations for the existing chart. Empty or failed history does not hide live listings; selected comparisons survive a delayed history response.
2. **Recall integrity:** malformed session data was cast directly to the expected type, while the upstream adapter interpreted a missing `results` field as an empty array. Web and native clients now share a runtime response contract; the web cache rejects malformed entries. The server rejects invalid upstream containers, records, and field types without caching them as successful empty results. Retry remains available.
3. **Recall scope and recovery:** both interfaces now say “Model recall notices” and explain that year/make/model results do not establish a particular VIN's repair status. Empty results no longer display a green “no open recalls” clearance. A static NHTSA link lets the user check their VIN separately; the app does not send a VIN in that link. This distinction follows [NHTSA's recall lookup guidance](https://www.nhtsa.gov/recalls).
4. **Cancellation:** recall requests now abort when their web dialog closes or the native screen loses focus. Cancellation guards prevent late completions from updating an obsolete screen. The native external-link failure path provides a manual recovery message.
5. **Dialog accessibility and resizing:** the phone sheet previously left the app root exposed when a live notification region prevented the library from hiding that root. Both shells now make the background inert and restore its previous state. The original keyboard-focus target is retained across shell changes. A resize between render and effect subscription is reconciled instead of leaving the wrong shell active.
6. **Stable interactive controls:** result cards and desktop dialog panels no longer translate into position while already clickable. This removes an avoidable source of moving click targets. The existing loading indicator, phone sheet behavior, overlay fade and hover feedback remain.
7. **Guide/health presentation:** corrected light/dark contrast on recall metadata, errors and guide warnings, and increased the guide close control to a 44px target. Visual inspection also found that `prose-*` classes depended on an absent plugin. Scoped CSS now supplies real headings, spacing, list markers, wrapping and code styling without installing a dependency. Existing safe-markdown restrictions remain intact and are exercised with hostile fixture content.
8. **Native packaging:** Jest/TypeScript accepted the shared recall import but the first iOS export did not resolve it through Metro. A minimal Expo-default Metro configuration now exposes only the dependency-free shared directory; the EAS ignore file explicitly includes its two recall-contract files. No React resolution override or whole-repository watch folder was added. See [Expo's Metro configuration guidance](https://docs.expo.dev/guides/customizing-metro/) and [Metro watch-folder documentation](https://metrobundler.dev/docs/configuration/#watchfolders).

## Executed verification

| Check | Result / evidence |
| --- | --- |
| Web production build / TypeScript | Passed; `artifacts/benchmarks/2026-09-06/closure-final-build.log`. |
| Web/server/tooling and mobile lint; browser harness TypeScript | Passed. The intentional native retry dependency is documented; no remaining warning from that change. |
| Server/API/tooling tests | **198 passed**, zero failed/skipped; `closure-final-unit.log`. Includes invalid upstream recalls and cache recovery, plus the existing account/security tests using stubs. |
| Native Jest | **132 passed**, 30 suites, zero failed/skipped; `closure-native.log`. Includes four new screen tests and two new API-contract/cancellation tests. |
| Native TypeScript | `npx tsc --noEmit` passed. |
| Complete browser matrix | **198 passed in one run**, zero failed/skipped; `closure-verified.log`. Chromium, Firefox and WebKit × desktop, phone and tablet. |
| Post-typography browser rerun | **54 passed**, zero failed/skipped; `closure-final-guides.log`. Reran the complete health/guide matrix after the final scoped CSS change, including computed heading weight/list markers and light/dark axe checks. |
| Existing built-UI Chrome check | Passed desktop/phone/tablet on the final build; `closure-final-workflows.log`. |
| iOS JavaScript/assets export | Passed after the Metro fix; `closure-ios-export-verified.log`, output `closure-ios-export-verified/`. Hermes bundle approximately 2.7 MB. Not a native compilation or signed build. |
| Native archive inclusion rules | Local `git check-ignore --no-index` with `.easignore` confirmed the two recall-contract exceptions and continued exclusion of unrelated shared modules. An actual cloud archive/submission was not created. |

The complete matrix includes the prior 132 WCAG A/AA scene scans plus 54 health/guide scans, keyboard navigation, 200% text reflow, history/refresh, clipboard success/denial and rapid taps, unavailable/slow/offline search, stale-request cancellation, comparison totals, and watchlist interactions. The final focused rerun repeats the 54 health/guide scans. Axe is automated coverage, not a screen-reader or full WCAG-conformance certification.

Earlier failures remain in the artifacts rather than being erased: four initial contrast failures; phone background isolation; a duplicate “Close” test locator; the native Metro resolution failure; missed breakpoint changes and lost focus; and intermittent clicks in moving interfaces. Safari does not normally focus a button on a pointer click, so focus-restoration tests now explicitly use keyboard activation. They do not falsely require Safari to behave like Chrome. The final recorded verification runs passed without forcing pointer actions or relaxing accessibility rules.

Representative before/after screenshots were visually inspected. Final health/guide screenshots for light/dark desktop, phone and tablet are under `artifacts/benchmarks/e2e/closure-final-guides/`. Runtime checks allow only explicitly injected fixture failures and reject unexpected application errors. The AI guide text in screenshots is test content, not validated repair advice.

## Performance evidence

`artifacts/benchmarks/2026-09-06/closure-v3.json` contains **45 cold samples**, five per scenario/profile. It uses the unchanged v3 fixture, Chrome 152.0.7977.76, 4× CPU and 1.6 Mbps/150ms networking. No tests or builds ran concurrently with this benchmark. It includes the existing 800ms delayed-search scenario and first-party WebP images, while excluding live providers, fonts, analytics and affiliate scripts. Nine screenshots are in `closure-shots/`.

| Profile / scenario | Previous → current usable content, p75 | Current LCP, p75 | Previous → current total main-thread time, p75 |
| --- | ---: | ---: | ---: |
| Desktop results | 1,966 → 1,946 ms | 1,952 ms | 1,233 → 1,109 ms |
| Phone results | 1,969 → 1,933 ms | 1,940 ms | 1,199 → 1,098 ms |
| Tablet results | 1,957 → 1,971 ms | 1,644 ms | 1,189 → 1,131 ms |
| Desktop delayed results | 2,539 → 2,522 ms | 2,524 ms | 1,483 → 1,397 ms |
| Phone delayed results | 2,513 → 2,503 ms | 2,504 ms | 1,456 → 1,347 ms |
| Tablet delayed results | 2,529 → 2,525 ms | 1,644 ms | 1,453 → 1,375 ms |

“Previous” is the preceding `parallel-search-v3.json` build, not the original baseline. Incremental main-thread reductions are approximately 5–10%; most readiness changes are small enough that sampling variation matters. Tablet ordinary-results readiness is 14.5ms slower, so this is not a claim that every timing improved. Homepage readiness is 1,612/1,596/1,594ms (desktop/phone/tablet). CLS remains 0 on home and 0.0006/0.0032/0.0008 on results.

The unchanged strict 15% comparison against the original `before-v3.json` **exits 1 with four relative flags**, not a pass:

- Homepage resource count **6 → 7** in all three profiles (+16.7%). Automatic splitting emitted a small shared `apiErrors` chunk. Initial JavaScript gzip is **95,637 bytes**, +339 bytes (+0.36%) versus the immediately preceding build. The added request remains visible rather than being hidden from the harness.
- Desktop ordinary-results long-task count **6 → 7** (+16.7%). Its aggregate main-thread time is lower, but that does not erase the count flag.

There are zero enforceable absolute-budget regressions. However, delayed desktop/phone LCP still misses the absolute 2,500ms target by **24ms / 4ms**; their original baselines also missed it. All other LCP scenarios and all CLS budgets pass. No thresholds were loosened and no samples were discarded.

The diagnostic Chrome trace shows that layout remains the dominant part of the largest result-rendering task (roughly 200ms under tracing and 4× throttling). Tracing changes timings and is not benchmark data. A diagnostic-only `contain: inline-size layout` experiment did not show a clear material benefit and was not added to source. A temporary plain-error simplification did not remove the extra bundle dependency and was reverted. The earlier rejected manual-chunk experiment is not reintroduced; preserving module execution order and working behavior takes priority over forcing a green count. These are open optimization findings, not claims of benchmark completion.

Final build fingerprint: **`sha256:b744c126e5a1f2167f707d9413f1a971333accbf8fa0b2f769b5377fd91e816e`**. A rebuild after reverting the unsuccessful experiment reproduced the measured fingerprint exactly (`closure-restored-build.log`). Test, export, diagnostic and benchmark processes exited; no matching background Node test/benchmark/export process remained after verification.

## Files changed in this continuation

The table describes this continuation only. Some listed files already contained earlier uncommitted fixes, which were preserved.

| File | Reason |
| --- | --- |
| `src/components/PriceHistoryCard.tsx` | Isolate optional history state, rendering and cancellation. |
| `src/components/ResultsList.tsx` | Mount the keyed history card and remove duplicate whole-screen history state/effect/markup. |
| `src/components/ListingCard.tsx` | Remove translated/staggered entrance motion from interactive cards. |
| `src/components/Modal.tsx` | Phone background isolation, original focus restoration across resizing, stationary desktop panel. |
| `src/hooks/useIsMobile.ts` | Reconcile a breakpoint change missed before effect subscription. |
| `src/components/VehicleHealthModal.tsx` | Recall retry/cancellation, accurate lookup scope, VIN-check link, contrast. |
| `src/components/RepairGuideModal.tsx` | Readable warning/error copy, accessible close target, working markdown styles. |
| `src/index.css` | Scoped light/dark guide typography and visible list markers. |
| `src/api/client.ts` | Abortable recall fetch with runtime response validation and shared type. |
| `src/lib/recallCache.ts` | Reject malformed cached recalls instead of trusting a type cast. |
| `shared/recalls.js` | Single web/native runtime recall contract. |
| `shared/recalls.d.ts` | Typed recall shape and validation predicate declaration. |
| `scripts/recalls.test.mjs` | Contract acceptance/rejection tests. |
| `server/recalls.js` | Reject malformed upstream responses/fields before mapping or caching. |
| `server/recalls.test.js` | Malformed upstream and subsequent recovery regression tests. |
| `mobile/src/api/client.ts` | Shared recall validation, type and caller cancellation. |
| `mobile/src/api/__tests__/client.test.ts` | Malformed recall and cancellation tests. |
| `mobile/src/app/vehicle-health.tsx` | Honest recall scope, cancellable focus lifecycle, accessible loading/link and browser recovery. |
| `mobile/src/app/__tests__/vehicle-health.test.tsx` | Empty response, retry, unmount cancellation and external-link failure tests. |
| `mobile/metro.config.js` | Preserve Expo defaults while making shared contracts visible. |
| `.easignore` | Include only the two newly required shared recall files in the native archive. |
| `mobile/README.md` | Explain shared-contract packaging and the required export verification. |
| `tests/web/history.spec.ts` | Delayed/missing/failed optional-history browser coverage. |
| `tests/web/vehicle-health-and-guides.spec.ts` | Recall/mileage/guide recovery, timeout/cancellation, safe markup, contrast, typography and screenshots. |
| `tests/web/interactions.spec.ts` | Responsive dialog shell and keyboard-focus regression coverage. |
| `docs/PERFORMANCE.md` | New coverage, state-isolation behavior and native packaging caveats. |
| `README.md` | Discoverable link to this report. |
| This report | Exact scope, results, limitations and remaining release requirements. |

Diagnostic scripts/traces in the ignored `artifacts/benchmarks/2026-09-06/` directory are local investigation evidence, not shipped app code. Unrelated video exports, scratch scripts, existing account/security changes, and other user work were not removed or reset.

## Remaining release requirements

- **P0:** None newly identified in the exercised scope. This is not proof of no security vulnerabilities.
- **P1 — device and release validation:** Physical iPhone/iPad checks for VoiceOver, Dynamic Type, camera permission/denial, keyboard/navigation, poor connectivity, and the intended native account flow. Native compilation/signing and TestFlight testing are still required; Windows emulation and a Hermes export cannot establish them.
- **P1 — authorized account lifecycle:** Verify irreversible account deletion, session expiry and partial-failure recovery in an explicitly authorized staging environment with disposable data. No production account was touched. Unit/stub tests do not establish deployed database policies or complete deployed-data erasure.
- **P2 — live behavior:** Real-provider latency, AI factual accuracy, production fonts/images, field Core Web Vitals and approved affiliate attribution remain unverified. Fixture results do not establish conversion or revenue.
- **P2 — performance gate:** Four small-count relative flags and two slightly missed delayed-LCP budgets remain as detailed above. Further optimization must demonstrate a repeatable benefit without weakening validation, loading unnecessary features eagerly, or changing bundler execution order casually.
- **P2 — CJ integration:** Obtain the current vendor-approved loading snippet or confirmation before changing the existing synchronous tag. Consent/privacy and attribution behavior were deliberately left unchanged.
- **P3 — broader coverage:** Additional editorial/authenticated/browser and assistive-technology coverage can be added after these local changes are reviewed; automated checks are not exhaustive usability research.

### Next five highest-value steps

1. Review and authorize the release branch/build; no push or submission was performed.
2. Exercise the intended TestFlight build on physical iPhone and iPad, including accessibility and camera flows.
3. Run the authorized staging account lifecycle/deletion check with disposable data.
4. Gather permitted production performance/provider measurements without silently changing privacy behavior.
5. Obtain CJ-approved loading guidance and perform an authorized affiliate-attribution check.
