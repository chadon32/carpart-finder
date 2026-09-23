# CarPartsRadar Live UX, QA, CRO, Accessibility, and Persona Audit

**Audit date:** July 30, 2026  
**Environment:** Local Vite app at `http://127.0.0.1:5198/`, proxied API at `http://127.0.0.1:3002/`  
**Method:** Live browser interaction, desktop journey testing, narrow-viewport attempt, source-supported route inventory, deliberate invalid-input testing, keyboard testing, and three persona journeys. No production data or real email notification was submitted.

## Remediation update — July 30, 2026

The release-blocking findings from this audit were remediated and retested against a freshly restarted local API:

- Added a frontend/API fitment-contract version and `/api/health` endpoint. Search and quote requests now fail closed when the API is stale, and the UI exposes an actionable service-unavailable warning with retry.
- Kept provider-confirmed compatibility matches separate from broad marketplace keyword results. Unconfirmed results are not recommendations and cannot enter automatic quotes or repair guides.
- Added title and listing-description contradiction checks. Explicitly incompatible makes, models, and model-year ranges are demoted even when a provider reports an exact match.
- Changed the compatibility-filtered marketplace fetch to relevance order so low-price accessories do not crowd exact matches out of the provider's first page. Accepted results are still ranked locally by delivered price.
- Replaced “Verified Fitment” with cautious marketplace-compatibility language. Detail and comparison views now show evidence provider, scope, checked time, matched fields, and limitations.
- Replaced the unauthenticated Save Search failure with an explicit sign-in/create-account action that opens the Account screen.
- Omitted engine-specific Timing Belt guidance when engine data is not confirmed and added an owner-manual explanation.
- Verified the 2020 Toyota Camry LE Sedan 4-Door / Brake Pads flow in the browser: 11 primary marketplace compatibility matches were separated from 14 unconfirmed results during the final run.
- Verified service outage and recovery, detail evidence, comparison evidence, account navigation, and Vehicle Health timing-belt omission.
- Verified the results view at a 390 px viewport with no document-level horizontal overflow and a visible fixed bottom navigation.

### Post-remediation score outlook

These are evidence-based estimates from the remediation retest, not a substitute for a fresh production audit.

| Area | Estimated score | Remaining constraint |
| --- | ---: | --- |
| Overall UX | 8.4/10 | Physical-device and authenticated-account testing remain. |
| UI | 8.7/10 | Long marketplace titles and recall text can still be dense. |
| Trust | 8.4/10 | Engine/drivetrain data is still not part of the provider contract. |
| Conversion | 8.1/10 | Match volume varies with live marketplace inventory. |
| Accessibility | 8.3/10 | VoiceOver, Dynamic Type, and physical touch testing remain. |
| Performance | 7.8/10 | Cold marketplace searches depend on provider latency. |

The original audit and scores below are retained as the before-remediation baseline.

## Executive summary

The current interface is visually polished and the main journey is easy to understand. Vehicle selection, VIN lookup, trim selection, diagnostics, OBD guidance, public trust pages, keyboard tabs, dialog dismissal, and empty/error validation generally work well.

The most important finding is environmental and release-blocking: the browser is connected to an older API process. That process labels unrelated Chrysler/Lexus listings as **Marketplace compatibility match** for a 2020 Toyota Camry, and account requests return a CORS-style “current app address” error. The source tree contains the newer fail-closed policy, but the live runtime did not load it. This must be resolved and retested before release.

| Area | Score | Assessment |
| --- | ---: | --- |
| Overall UX | 6.8/10 | Clear main flow, but trust collapses when live results contradict the selected vehicle. |
| UI | 8.4/10 | Strong visual hierarchy, consistent components, good dialogs and states. |
| Trust | 3.8/10 | Fitment labels are unsafe in the observed runtime; account-service failure also damages confidence. |
| Conversion | 5.9/10 | Search is compelling, but generic save failure and questionable recommendations create abandonment risk. |
| Accessibility | 7.8/10 | Good names, alerts, tabs, dialog Escape behavior, and keyboard tab movement; physical screen-reader and mobile-device testing remain. |
| Performance | 7.1/10 | Local page is responsive; search requests took roughly 2–4 seconds and live API readiness is not visible. |

### Release decision

**Do not ship the currently running build.** Restart or redeploy the API from the current source, verify that the runtime serves the fail-closed fitment behavior, then repeat the browser tests with a disposable authenticated account.

## Evidence captured during live testing

- Landing page loaded with accessible header, three-step progress indicator, vehicle selector, Garage guidance, recent searches, trust copy, and policy/footer links.
- 2020 Toyota Camry selection exposed trim options from eBay compatibility data and saved successfully to Garage.
- VIN `1HGCM82633A004352` decoded to a 2003 Honda Accord; invalid characters in a VIN were silently stripped and left Decode disabled.
- Blank part search showed an announced validation error.
- OBD `hello` showed format validation; `P0302` showed cautious diagnostic guidance; unknown `P9999` showed a verified-explanation warning.
- Symptom diagnosis returned possible causes, an optional timing question, parts commonly inspected, and a caution that it is not a professional inspection.
- Quote output stated that unknown-fitment listings are excluded and included shipping in the estimate.
- Results for 2020 Toyota Camry LE showed a Chrysler 300 listing and multiple Lexus listings as “Marketplace compatibility match.” The detail modal repeated that claim and the comparison modal displayed “Verified Fitment.”
- “Save search” while unauthenticated displayed “Couldn't save — try again” rather than directing the user to sign in.
- Account creation validation worked for blank and short passwords, but a valid local test request returned “This request isn't allowed from the current app address. Reload the official site and try again.”
- Public guides, methodology, about, contact, privacy, terms, and affiliate-disclosure pages loaded with headings, breadcrumbs, metadata structure, skip links, and navigation.
- Dialogs dismissed with Escape. Search-method tabs moved with ArrowRight and exposed selected tab/tabpanel semantics.

## Persona 1 — Professional mechanic

### Journey map

Landing → select 2020 Toyota Camry → choose LE trim → save to Garage → search Brake Pads → inspect price/shipping/seller → open detail → compare two listings → run symptom diagnosis and quote.

### Emotional reactions

Fast and interested during vehicle selection; confident during diagnosis and quote framing; immediately skeptical when a Chrysler 300 listing appeared under a Camry search; unwilling to trust the “compatibility match” or “Verified Fitment” labels.

### What worked

- OEM/part-name search is prominent and keyboard-friendly.
- Trim choices are more useful than a generic year/make/model-only selector.
- Cards expose delivered price, shipping, seller feedback, location, condition, and delivery dates.
- The comparison table is useful once two listings are selected.
- Diagnostic copy correctly distinguishes a detected code or symptom from a confirmed failed part.

### Pain points and trust concerns

- The observed runtime claims fitment for listings whose titles explicitly identify a different vehicle.
- The comparison modal repeats “Verified Fitment” without enough visible evidence scope.
- “Save search” fails generically for an unauthenticated user instead of explaining the account requirement.
- Engine and drivetrain are still absent from the primary vehicle identity, so even a valid year/make/model match is not enough for many parts.
- Vehicle Health displays a generic Timing Belt interval even though engine applicability is not confirmed.

### Missing features

- Engine/drivetrain/drive-side confirmation.
- OEM cross-reference and provider evidence details.
- A fast batch/OEM-number workflow for shop use.
- Saved vehicles with technician notes and mileage history.

### Recommendations

1. Make the live API readiness/version visible and fail closed if the running server does not support the current fitment contract.
2. Show evidence scope in the comparison table: provider, year/make/model coverage, timestamp, and “trim/engine not confirmed” where applicable.
3. Add engine/drivetrain selection or explicitly label the result as year/make/model-only.
4. Provide “Sign in to save this search” instead of a generic failure.

**Satisfaction:** 5.2/10 in the observed runtime; potentially 7.5/10 after fitment and API deployment issues are resolved.

## Persona 2 — Everyday driver with limited automotive knowledge

### Journey map

Landing → choose vehicle from guided controls → choose a popular part → read the results → inspect a listing → try to understand fitment → use symptom guidance and OBD explanations.

### Emotional reactions

The step indicator and popular-part buttons feel reassuring. The vehicle and symptom explanations reduce intimidation. The contradictory listing titles create uncertainty about whether any result is safe to buy.

### What worked

- The homepage explains the value proposition in plain language.
- VIN helper text clearly identifies where to find a VIN and which letters are excluded.
- OBD copy says a code is a detected condition, not proof of a failed part.
- The diagnostic result includes “not a professional inspection” and suggests mechanic confirmation.
- Public methodology and privacy pages create useful trust signals.

### Confusing moments

- “Marketplace compatibility match,” “Verified Fitment,” “best value,” and “cheapest deal” sound definitive even when the title names another vehicle.
- “Trim” and “drivetrain” are not explained in the buying decision.
- A failed “Save search” action does not explain that an account is required.
- “Vehicle health” includes technical maintenance intervals without enough context about engine variation.

### Missing features

- A clear “Why this fits” explanation written for nontechnical users.
- A confidence state such as Confirmed / Needs confirmation / General search.
- Short tooltips for trim, engine, drivetrain, core charge, and seller feedback.
- A guided “I’m not sure which part I need” path that ends in a local retailer or mechanic option.

### Recommendations

1. Use one consistent fitment vocabulary across cards, details, quotes, and comparison.
2. Add a plain-language warning whenever fitment is only year/make/model-level.
3. Replace generic account failures with a sign-in/create-account prompt.
4. Make the next safe action explicit: “Confirm the part number on the retailer page before buying.”

**Satisfaction:** 6.4/10 for the UI and guidance; 3.5/10 for purchase confidence under the observed results.

## Persona 3 — Average user

### Journey map

Landing → select Garage vehicle → tap Brake Pads → scan prices → toggle filters → select two listings → compare → return to part search.

### Emotional reactions

The visual design feels modern and focused. The flow is quick after the vehicle is chosen. The quantity of listing metadata becomes dense, and the wrong-vehicle titles create hesitation at the moment of decision.

### What worked

- Clear three-stage progress pattern.
- Live price and shipping presentation is easy to scan.
- Filter controls and comparison affordance are visible.
- Comparison is correctly disabled until a second listing is selected.
- Back-to-part and change-vehicle navigation work without a broken state.

### Friction

- The first result can appear attractive because of “Best Value” and “Cheapest Deal” before the user notices the conflicting title.
- The result page has many competing labels, discounts, seller data, shipping, delivery, and actions.
- Unauthenticated save-search failure interrupts the conversion path.
- Search loading states are visible, but API readiness is not communicated when the backend is stale or misconfigured.

### Recommendations

1. Make the primary card hierarchy: fitment state → total price → delivery → seller → secondary metadata.
2. Hide “Best Value” until the runtime has confirmed the listing’s fitment evidence.
3. Add a compact “Sign in to save” state.
4. Add an API health/version check to development and staging environments.

**Satisfaction:** 6.5/10.

## Page-by-page audit

### Landing and vehicle selector

**Works:** Strong hero hierarchy, clear promise, accessible labels, popular vehicle categories, VIN path, Garage empty guidance, recent-search affordances, and clear footer trust/legal links.  
**Issues:** Invalid VIN characters are silently removed instead of announced. The page says fitment evidence is shown for every match, but the current runtime does not provide trustworthy evidence. The “every trim” copy is stronger than the actual year/make/model workflow.  
**Severity:** High for fitment promise; Low for VIN feedback.  
**Fix:** Add a server/runtime capability indicator and show a friendly invalid-VIN message. Reword “every trim” to distinguish NHTSA vehicle data from marketplace trim evidence.  
**Impact:** High trust and completion impact.

### Part search

**Works:** Five distinct search methods, tab semantics, keyboard arrow navigation, autocomplete, popular parts, empty validation, and clear vehicle context.  
**Issues:** Technical terms are not explained inline; photo search and account-dependent paths need physical-device/API testing.  
**Severity:** Medium.  
**Fix:** Add concise helper tooltips and a visible recovery state for unavailable AI/photo services.  
**Impact:** Medium conversion and confidence impact.

### Maintenance kits

**Works:** Timing-belt service is omitted from the kit selector when engine applicability is unknown; the page explains why. Component searches are framed as searches, not confirmed repairs.  
**Issues:** Vehicle Health still shows a generic Timing Belt interval for the same vehicle without engine confirmation.  
**Severity:** High.  
**Fix:** Gate timing-belt display on engine applicability or label it “manual-only educational reminder; applicability unknown.”  
**Impact:** High safety/trust impact.

### OBD-II

**Works:** Format validation, unknown-code warning, cautious diagnosis language, and “parts commonly inspected” wording.  
**Issues:** There is no visible link to a manufacturer-specific code lookup or service-manual source.  
**Severity:** Low/Medium.  
**Fix:** Add a source/help link and a stronger “do not replace parts based on code alone” callout for novice users.  
**Impact:** Medium trust impact.

### Photo search

**Works:** Clear image-quality instructions, accessible upload button, and a single-purpose flow.  
**Issues:** A real image upload and AI failure/retry path were not exercised because doing so would submit an external AI request from the local environment.  
**Severity:** Medium unverified.  
**Fix:** Add a local/staging fixture mode and test oversized, unsupported, blurry, timeout, and AI-unavailable cases.  
**Impact:** Medium.

### Symptom diagnosis and quote

**Works:** Good progressive disclosure, example symptoms, possible-cause options, optional timing question, cautionary language, selected-part checkboxes, shipping-aware quote, and explicit unknown-fitment exclusion.  
**Issues:** Quote output inherits the stale runtime’s incorrect match labels. Diagnosis language such as “not an emergency yet” should be carefully scoped for safety-critical symptoms.  
**Severity:** High because quote safety depends on fitment; Low/Medium for copy.  
**Fix:** Resolve API deployment, then add test fixtures that prove only the verified group can enter quotes.  
**Impact:** High.

### Results

**Works:** Sort/filter controls, delivered-price totals, seller evidence, comparison guard, outbound retailer options, price-alert validation, and detail dialogs.  
**Issues:** Live browser results show Chrysler/Lexus titles under a Camry query as “Marketplace compatibility match.” Comparison shows “Verified Fitment.” This is the release-blocking issue.  
**Severity:** Critical.  
**Fix:** Restart/deploy the current API, verify `fallbackResults` and signed fitment proof are present, and add a runtime contract/version check. Do not release based on source inspection alone.  
**Impact:** Critical trust, safety, and Apple review risk.

### Detail and comparison dialogs

**Works:** Accessible names, focus state, Escape dismissal, comparison requires two listings, scrollable table semantics, seller/shipping details.  
**Issues:** The detail and comparison wording inherits the unsafe “Marketplace compatibility match” / “Verified Fitment” claim.  
**Severity:** Critical when backed by stale API; Medium after runtime correction if evidence scope remains hidden.  
**Fix:** Use “Marketplace compatibility match — year/make/model only” and show provider evidence directly in the comparison table.  
**Impact:** High.

### Vehicle Health report

**Works:** NHTSA recall results loaded, recall identifiers and remedies are visible, mileage accepts valid values and persists after reopen, and intervals include owner-manual caveats.  
**Issues:** Timing Belt appears despite unknown engine applicability; recall copy is long and dense for a novice user.  
**Severity:** High for timing-belt applicability; Medium for readability.  
**Fix:** Gate or relabel timing-belt intervals and add compact recall summaries with expandable detail.  
**Impact:** High safety/trust impact.

### Account and watchlist

**Works:** Empty/sign-in/create-account states are clear, blank and short-password validation is announced, Google link is visible, and account navigation is straightforward.  
**Issues:** Local valid account request failed with an origin/CORS message; authenticated deletion, saved-search loading, logout, and permanent deletion could not be completed in the browser. Save Search gives a generic failure when unauthenticated.  
**Severity:** Critical release verification gap; High conversion friction.  
**Fix:** Restart/deploy the API with the current CORS policy, test a disposable account end to end, then verify account deletion, row cleanup, Auth deletion, logout, and local-storage cleanup.  
**Impact:** Critical for account functionality and App Store compliance.

### Public guides, methodology, about, contact, and policies

**Works:** All seven primary public pages loaded. They expose skip links, breadcrumbs, headings, legal/footer navigation, metadata structure, contact path, methodology, affiliate disclosure, and account-deletion/privacy language.  
**Issues:** These pages are text-heavy; a novice user may need shorter summaries and stronger in-context links back to the search flow.  
**Severity:** Low/Medium.  
**Fix:** Add summary callouts and “Start with your vehicle” CTAs without weakening the legal detail.  
**Impact:** Medium trust and SEO/conversion impact.

### Mobile and narrow viewport

**Works:** The code includes mobile navigation and horizontally scrollable controls.  
**Issues:** The available browser session did not expose a true narrow layout despite requested viewport options, so physical-width mobile behavior, touch targets, keyboard-on-mobile, and overflow cannot be marked verified in this run.  
**Severity:** Medium unverified.  
**Fix:** Run on a real iPhone/iPad or a browser session with confirmed viewport emulation; test 320, 375, 390, and iPad widths with zoom/text scaling.  
**Impact:** High for App Store confidence.

## Improvement backlog

### Critical

- Restart/redeploy the API and prove the browser is using the current fail-closed fitment contract.
- Add a build/version or health endpoint so a stale API cannot silently serve unsafe results.
- Retest the exact 2020 Toyota Camry scenario and ensure contradictory Chrysler/Lexus listings move to the fallback section or disappear from the verified group.
- Resolve the local/staging CORS failure and complete account creation, sign-in, deletion, logout, and data cleanup with a disposable account.
- Ensure comparison/detail/quote labels cannot say “Verified Fitment” without a valid server-issued proof.

### High impact

- Remove or relabel Timing Belt from Vehicle Health until engine applicability is known.
- Replace unauthenticated “Couldn't save — try again” with an account-required sign-in/create prompt.
- Show fitment evidence scope and timestamp in listing details and comparison.
- Add engine/drivetrain selection or a clearly visible year/make/model limitation.
- Add runtime API capability checks to staging and release smoke tests.

### Medium

- Add novice-friendly tooltips for trim, engine, drivetrain, core charge, and seller feedback.
- Add mobile physical-device and screen-reader regression coverage.
- Add photo-search fixture tests for unsupported files, oversized files, timeouts, and AI-unavailable states.
- Add concise recall summaries with expandable full text.
- Add a service-manual/manufacturer lookup link for unknown OBD codes.

### Low

- Add advanced mechanic tools: saved vehicle notes, batch OEM lookup, exportable comparison, and part-number cross-reference.
- Add compact public-page summaries and stronger “Start searching” CTAs.
- Add recent-search deduplication and a clearer “clear history” confirmation if the list grows.

## Feature recommendations

| Feature | User/problem | Effort | Expected impact | Recommendation |
| --- | --- | ---: | ---: | --- |
| Fitment evidence drawer | Everyone needs to know why a listing is considered compatible. | M | Very high | Implement immediately. |
| Engine/drivetrain selector | Mechanics need application-level precision; drivers need confidence. | M/L | Very high | Implement after provider data contract is confirmed. |
| “Sign in to save” conversion gate | Current generic save failure loses intent. | S | High | Implement immediately. |
| API readiness/build contract check | Prevents stale unsafe server/frontend combinations. | S/M | Very high | Implement immediately in staging and release smoke tests. |
| Recall summary cards | Long NHTSA text overwhelms novice users. | S | Medium | Next sprint. |
| Mechanic batch/OEM workspace | Reduces repetitive searches for professional users. | L | High for shops | Future, after core trust is reliable. |

## Competitive analysis

CarPartsRadar’s strongest differentiator is cross-marketplace comparison plus diagnosis/editorial guidance. The main gap is application-level fitment certainty and operational trust.

- AutoZone makes the vehicle selector prominent and supports year/make/model/engine and VIN-oriented shopping, setting a higher expectation for vehicle identity before purchase: [AutoZone vehicle shopping](https://www.autozone.com/parts).
- RockAuto separates part-number search from catalog/application lookup and tells users to use the vehicle application when a cross-reference is unavailable: [RockAuto help](https://www.rockauto.com/help/?page=1).
- CarParts.com emphasizes a vehicle selector and VIN-based fitment guarantee as a central purchasing promise: [CarParts.com fitment guidance](https://www.carparts.com/help-center/guaranteed-to-fit).

Patterns to borrow:

1. Keep the selected vehicle visible and editable on every result/detail page.
2. Treat engine and VIN as first-class fitment inputs, not optional metadata hidden after the search.
3. Explain fitment at the product level with provider-backed evidence, not only a badge.
4. Put the safest next action beside uncertainty: verify VIN/engine, view service manual, or contact a professional.
5. Keep comparison focused on total delivered price and confirmed application, while relegating generic marketplace matches to a clearly separate section.

## Final roadmap

### Phase 1 — Immediate release blockers

1. Restart/redeploy the API from the current source and add a runtime build/version check.
2. Repeat the Camry fitment search and verify contradictory listings are not primary matches.
3. Resolve CORS/configuration and run disposable-account account creation, sign-in, deletion, logout, and cleanup tests.
4. Gate/relabel Vehicle Health Timing Belt guidance.
5. Replace generic unauthenticated save failure with a sign-in/create-account path.

### Phase 2 — Next sprint

1. Add engine/drivetrain and evidence-scope UI.
2. Add browser/device accessibility regression coverage.
3. Add photo and diagnosis failure fixtures.
4. Improve recall summaries, OBD resources, and novice tooltips.
5. Measure deployed Core Web Vitals and search latency by provider.

### Phase 3 — Future

1. Build mechanic batch/OEM workflow and vehicle notes.
2. Add stronger part-number cross-reference and manufacturer-source integrations.
3. Add saved comparisons, export, and retailer availability/location options.
4. Revisit personalization and analytics only after fitment trust and account reliability are proven.

## Verification limits

- Supabase credentials were not configured in the local environment, so authenticated account deletion was not executed end to end.
- The browser was connected to a stale API process, so the current source-level fail-closed behavior was not the behavior observed in the live results page.
- No real email, account notification, purchase, or production deletion was initiated.
- Photo upload/AI processing, physical iPhone/iPad interaction, screen reader testing, and deployed Core Web Vitals remain unverified.
- Luna performed only a read-only route/CTA/metadata inventory; all live browser conclusions and prioritization were reviewed by the main agent.
