# CarPartsRadar four-persona web and iOS audit

Date: August 1, 2026

## Scope and method

This audit covered the public website at desktop and 390-pixel mobile widths, the Expo/iOS application, API contracts, marketplace search behavior, accessibility semantics, error and empty states, persistence, and production builds. Live browser journeys were combined with source review and automated tests.

The local environment intentionally has no Supabase credentials. Guest journeys were exercised live. Signed-in account and permanent-deletion behavior was reviewed in code and automated tests, but must still receive one physical-device staging test before release.

## Executive scorecard after fixes

| Surface | UX | UI | Trust | Conversion | Accessibility | Performance | Overall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop website | 8.8 | 8.8 | 8.9 | 8.4 | 8.8 | 8.7 | **8.7** |
| Mobile website | 8.7 | 8.7 | 8.9 | 8.3 | 9.0 | 8.6 | **8.7** |
| iOS app | 8.5 | 8.5 | 9.0 | 8.2 | 8.7 | 8.7 | **8.6** |

These are evidence-based release-readiness scores, not a claim of perfection. The remaining fitment-data and physical-device gaps keep the product below 10/10.

## Persona reports

### 1. Professional mechanic

Journey: select a saved Garage vehicle or VIN, enter a part, scan verified listings, inspect seller and fitment evidence, compare, then open a repair guide only from a proof-backed listing.

- Satisfaction: **8.6/10**, up from an estimated 7.2 before this pass.
- Positive: saved vehicles now select reliably; VIN is the fastest path; verified and unverified inventory are clearly separated; wrong-vehicle titles are rejected; filters and price totals are fast to scan.
- Friction: evidence is usually year/make/model, not engine, drivetrain, option code, or OE interchange depth. Generic fallback titles can still be noisy.
- Trust need: expose provider evidence and OE/interchange fields when the marketplace supplies them.
- Best next feature: VIN-specific engine and drivetrain confirmation plus an OE-number-first search mode.

### 2. Everyday driver with limited automotive knowledge

Journey: choose a vehicle manually, use guided part selection, read the no-confirmed-match warning, inspect one listing, and follow the compatibility checklist before leaving for a retailer.

- Satisfaction: **8.7/10**, up from an estimated 7.1.
- Positive: plain-language recovery states, VIN guidance, large mobile controls, explicit “fitment not verified” labels, and retailer alternatives reduce dead ends.
- Friction: terms such as trim, drivetrain, OE number, and fitment still require short explanations near the decision point.
- Abandonment risk: a fallback list containing vague titles such as clips or generic pads can look irrelevant even when correctly labeled.
- Best next feature: a short “Help me identify the exact part” wizard using location, symptoms, and a photo.

### 3. Budget-conscious DIY shopper

Journey: search, sort by total cost or value, compare listings, inspect seller quality and shipping, add to Watchlist, then compare retailer searches.

- Satisfaction: **8.4/10**, up from an estimated 6.9.
- Positive: Best Value is now calculated instead of assuming the first result; price and shipping are separated; comparison requires at least two items; external store paths remain available when verified inventory is thin.
- Friction: other stores are search links rather than normalized live offers, and fallback inventory is intentionally not ranked as a recommendation.
- Trust need: show when each price was observed and explain the value calculation.
- Best next feature: normalized delivered-price comparison across approved retailer feeds.

### 4. Returning mobile and accessibility-focused user

Journey: return to a saved vehicle or recent search, use Watchlist/Garage/Account, navigate with semantic controls, and find profile/settings/account deletion while signed in.

- Satisfaction: **8.8/10**, up from an estimated 6.8.
- Positive: the website has no visible interactive target below 44 by 44 pixels at 390 pixels wide; major app controls now have roles and labels; saved Garage selection no longer races asynchronous model loading; local stores hydrate safely on web; deletion copy matches CarPartsRadar.
- Friction: VoiceOver, Dynamic Type at the largest sizes, Switch Control, and native tab targets still require physical-device verification.
- Best next feature: an in-app accessibility preference for denser or larger result cards while respecting system text size.

## Page and workflow findings

| Area | What now works | Remaining issue | Severity | Expected impact |
| --- | --- | --- | --- | --- |
| Landing/search | Clear promise, strong primary action, mobile-safe width and touch targets | Advanced mechanic mode is absent | Low | Faster orientation for all users |
| Garage vehicle selection | Saved year/make/model/trim now survives async option loading | No fleet or shop grouping | Low | Removes a workflow-blocking race |
| VIN/manual picker | VIN helper text, validation semantics, dynamic 1980 through next-model-year range | Physical camera scan not tested in this Windows environment | Medium | More reliable vehicle selection |
| Results | Verified inventory and keyword fallback are separate; filters include all visible tiers | Generic fallback relevance can still be weak | High | Prevents false fitment confidence |
| Fitment security | Explicit wrong make/model/year titles are filtered, including structured description contradictions | Provider evidence is not always option-level | High | Major trust and safety improvement |
| Listing detail | Unverified warning is persistent; repair guide appears only with valid proof | More OE/interchange evidence would help mechanics | Medium | Reduces unsafe purchases |
| Comparison | Requires two items and explains the next action | No side-by-side external retailer data | Low | Removes a confusing dead action |
| Watchlist/recents | Accessible controls and persisted state | Cross-device sync depends on signed-in backend behavior | Medium | Better return visits |
| Account deletion | Correct CarPartsRadar data list, typed DELETE confirmation, duplicate-tap protection, stale-session handling, local-data cleanup | Live staging Supabase test still required | High | App Store and privacy compliance |
| Errors/empty states | Network, stale, no-results, and fallback-only paths are distinct and recoverable | Search service contract mismatch could be explained more prominently | Low | Fewer dead ends |
| Mobile layout | No horizontal overflow and no undersized website controls in the measured flow | Native app still needs largest-Dynamic-Type screenshots | Medium | Better one-handed and accessible use |

## Problems fixed in this pass

1. Repaired the saved-Garage selection race that cleared the selected model and disabled Continue.
2. Raised mobile website controls to the 44-point minimum, including filters, share, footer, listing actions, vehicle chips, and account controls.
3. Prevented listing actions from wrapping into unusable narrow mobile columns.
4. Filtered explicit wrong make, model, and model-year marketplace results before display.
5. Preserved broad but unknown-fitment inventory in a separate, clearly warned fallback section.
6. Enforced the current fitment contract in the iOS API client so stale servers fail closed.
7. Made fallback-only results visible in the app instead of showing a false empty state.
8. Removed the always-failing results-level repair-guide action; guides now require a verified listing and signed proof.
9. Replaced the misleading first-result “Best Value” assumption with a cost-and-seller-trust score.
10. Corrected account-deletion disclosure text that incorrectly referred to solar data.
11. Added app accessibility roles, labels, states, alerts, and 44-point controls across key flows.
12. Expanded vehicle years from the previous hard-coded 1990 cutoff to 1980 through the next model year.
13. Fixed Expo web server rendering around persisted AsyncStorage stores.
14. Added a safe local/staging API override without changing the production default.
15. Reduced the exported iOS asset count from 57 to 26 by importing only three used font weights.

## Files changed in this audit pass

Website and API:

- `src/App.tsx`
- `src/index.css`
- `src/components/CarSelector.tsx`
- `src/components/Dashboard.tsx`
- `src/components/ListingCard.tsx`
- `src/components/RecentSearches.tsx`
- `src/components/ResultsList.tsx`
- `server/lib/fitmentPolicy.js`
- `server/lib/fitmentPolicy.test.js`
- `server/providers/ebay.js`
- `server/providers/ebay.test.js`

iOS/Expo app:

- `mobile/.env.example`
- `mobile/.gitignore`
- `mobile/src/api/types.ts`
- `mobile/src/api/client.ts`
- `mobile/src/api/__tests__/client.test.ts`
- `mobile/src/app/(tabs)/index.tsx`
- `mobile/src/app/_layout.tsx`
- `mobile/src/app/delete-account.tsx`
- `mobile/src/app/listing-detail.tsx`
- `mobile/src/app/repair-guide.tsx`
- `mobile/src/app/results.tsx`
- `mobile/src/app/vehicle-health.tsx`
- `mobile/src/app/vehicle-picker.tsx`
- `mobile/src/components/AccountCard.tsx`
- `mobile/src/components/ListingCard.tsx`
- `mobile/src/components/PickerList.tsx`
- `mobile/src/components/VehicleCard.tsx`
- `mobile/src/lib/accountDeletion.ts`
- `mobile/src/lib/listingFilters.ts`
- `mobile/src/lib/persistence.ts`
- `mobile/src/lib/resultsPresentation.ts`
- `mobile/src/lib/resultsState.ts`
- `mobile/src/lib/vehicleYears.ts`
- `mobile/src/lib/__tests__/accountDeletion.test.ts`
- `mobile/src/lib/__tests__/listingFilters.test.ts`
- `mobile/src/lib/__tests__/resultsPresentation.test.ts`
- `mobile/src/lib/__tests__/resultsState.test.ts`
- `mobile/src/lib/__tests__/vehicleYears.test.ts`
- `mobile/src/stores/garage.ts`
- `mobile/src/stores/prefs.ts`
- `mobile/src/stores/recents.ts`
- `mobile/src/stores/watchlist.ts`

Audit artifact:

- `docs/audits/carpartsradar-four-persona-web-ios-audit-2026-08-01/README.md`

## Verification

- Web/server tests: 136 passed.
- Mobile tests: 65 passed across 16 suites.
- Root lint: passed.
- Mobile Oxlint: passed with no errors or warnings.
- Web TypeScript and production Vite build: passed.
- Mobile TypeScript: passed.
- Expo iOS export: passed; 2.8 MB Hermes bundle and 26 assets.
- Live mobile website: 390-pixel viewport, zero horizontal overflow, zero measured visible targets below 44 by 44 pixels.
- Live contradiction check: explicit Ford, Nissan, Dodge, Mini, and out-of-range vehicle listings were absent from the Camry brake-pad fallback set after the fix.

## Remaining prioritized backlog

### P1 - before the next App Store build

1. Run the release build on a physical iPhone and iPad with VoiceOver, largest Dynamic Type, camera VIN scan, poor network, and back/refresh paths.
2. Configure a staging Supabase project and complete one real create-account, stale-session reauthentication, permanent-deletion, relaunch, and recreate-account test.
3. Record the full App Review account-creation-to-deletion path from that exact uploaded build.

### P2 - next sprint

1. Add stronger part-relevance checks so generic clips and incomplete kits do not dominate fallback inventory.
2. Surface engine, drivetrain, OE number, position, and interchange evidence when providers supply it.
3. Add a maintained mobile lint command/configuration to CI; the root lint script currently excludes `mobile/src`.
4. Add app component tests for fallback section rendering, repair-guide visibility, filters, and accessibility labels.

### P3 - future

1. Add normalized retailer-feed pricing and delivered-total comparisons.
2. Add mechanic fleet/shop workflows and OE-number-first search.
3. Add novice part-identification guidance using photo, symptom, and location prompts.

## Release conclusion

CarPartsRadar is materially safer, clearer, and more accessible than at baseline and now grades above 8/10 for all four personas. It is ready for a staging/physical-device release candidate, not yet a justified 10/10. The two release gates are a real Supabase deletion journey and physical iOS accessibility/device verification.

## Follow-up quality pass - August 2, 2026

This follow-up addressed the biggest remaining user-facing search and decision-support gaps without relaxing the fitment safety policy.

### Improvements verified in this pass

1. Keyword fallback listings now pass a conservative part-intent check before display. For known part types, obvious accessory-only results such as brake-pad clips, wear sensors, and "Disc Brake Pad Shoes Accessories" are removed. Provider-confirmed listings are never suppressed by this heuristic.
2. The API reports how many accessory-only fallback listings were omitted. Web and iOS results explain that choice instead of silently hiding inventory.
3. Web and iOS now give clear recovery actions when no listings are available: choose another part or retry the search.
4. iOS listing detail now explains the source, scope, matched vehicle fields, provider timestamp when valid, and a buyer confirmation checklist. Unverified listings are persistently labeled as such.
5. The iOS part search accepts an OEM number, normalizes pasted whitespace, enforces the same 60-character maximum as the server, and exposes an accessible label and visible character count.
6. The iOS trim selector now explains that trim means a package such as LE, Sport, or Limited and can be skipped when unknown. The website provides the same help at the decision point.

### Evidence collected

- Live local search for a 2020 Toyota Camry / Brake Pads: zero verified listings, nine clearly labeled fallback listings, and two accessory-only listings removed. The formerly visible "Disc Brake Pad Shoes Accessories" result was absent after the fix.
- Live website check at 390 by 844 CSS pixels: document width 380, no horizontal overflow, 66 visible controls, and no measured visible control below 44 by 44 pixels.
- Web/API tests: 139 passed.
- iOS tests: 71 passed across 18 suites.
- Root lint, iOS lint, iOS TypeScript, and production web build: passed.

### Updated evidence-based scorecard

| Surface | Overall | Why it is not yet release-certified at 9.5+ |
| --- | ---: | --- |
| Desktop website | 9.1 | Marketplace fallbacks still lack option-level and OE/interchange evidence. |
| Mobile website | 9.1 | The measured responsive flow is strong, but complete assistive-technology coverage needs real-device testing. |
| iOS app | 9.0 | Static and simulator/export checks pass, but no physical iPhone/iPad or live Supabase deletion run was available in this environment. |

It would not be accurate to claim a release-certified 9.5+ until the remaining P1 gates are completed. The code and automated checks are now materially closer: the remaining work depends on real device behavior and a safely configured staging Supabase project, not a known unaddressed code failure.

## Account-deletion hardening follow-up - August 2, 2026

This pass closed the largest remaining code-level weakness in the App Store account-deletion journey: recovery from an expired session. It also made the deletion result durable enough for a reviewer to verify after the app signs the user out.

### Improvements verified in this pass

1. The website now detects an expired deletion session, signs out locally, asks the user to authenticate with the same email address, and automatically reopens the deletion confirmation after login.
2. The iOS app now gives an expired-session user a direct **Sign in again** action, pre-fills and locks the flow to the same account email, and returns to the deletion screen after successful authentication.
3. A signed-out user who deep-links to the native deletion route cannot enter confirmation text or submit deletion; the only enabled action is authentication.
4. Website and native deletion now have 25-second client timeouts around the existing 20-second backend deadline. Timeout and uncertain final-state errors use retry-safe copy instead of hanging forever or falsely claiming success.
5. Successful native deletion clears application state, signs out, replaces the navigation stack, and shows a persistent **Account permanently deleted** confirmation on the signed-out account screen.
6. Native authentication fields now have visible labels, autofill metadata, keyboard behavior, accessible alerts, and explicit disabled/busy state.
7. The root lint command now checks both website/server code and `mobile/src`, closing the previous CI coverage gap.
8. Regression coverage now includes website request/body timeouts and native success, cancel, failed deletion, stale session, network error, timeout, rapid-tap protection, already-deleted handling, signed-out deep links, same-account reauthentication, persistent success messaging, and post-deletion local-cache failure handling.

### Live browser evidence

- Ran an isolated local mock-auth journey from account creation through typed `DELETE`, permanent deletion, sign-out, local-data reset, and the visible message **Your account has been permanently deleted.**
- The delete button stayed disabled until the exact confirmation was entered.
- At a 390 by 844 CSS-pixel viewport, the landing and signed-out account screens had no horizontal overflow and no measured visible interactive target below 44 by 44 pixels.
- No production account or production data was used for this validation.

### Automated release evidence

- Web/API tests: **142 passed**.
- iOS tests: **85 passed across 19 suites**.
- Full website/server and mobile lint: passed.
- Website production TypeScript and Vite build: passed.
- iOS TypeScript: passed.
- Expo iOS export: passed with a 2.8 MB Hermes bundle and 26 assets.
- `git diff --check`: passed.

### Updated evidence-based scorecard

| Surface | Overall | Remaining release gate |
| --- | ---: | --- |
| Desktop website | 9.3 | Live staging Supabase deletion and final production telemetry still require a non-production environment. |
| Mobile website | 9.3 | Screen-reader and browser-matrix checks still need real devices. |
| iOS app | 9.3 | A physical iPhone/iPad TestFlight run with VoiceOver, largest Dynamic Type, poor network, relaunch, and real staging deletion is still required. |

The account-deletion implementation itself is now production-shaped and substantially better protected against stale sessions and accidental repeat actions. A release-certified 9.5+ score still requires the two external evidence gates above; assigning that score from Windows automation alone would overstate what was verified.
