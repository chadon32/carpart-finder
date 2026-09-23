# CarPartsRadar Post-Fix UX, CRO, Accessibility, and QA Audit

**Audit date:** July 30, 2026  
**Environment:** Local Vite web app at `http://127.0.0.1:5198/` with local API at `http://127.0.0.1:3002/`  
**Method:** Live browser interaction on desktop and a 380 × 844 mobile viewport, source-supported state inventory, automated baseline checks, deliberate failure testing, and three independent persona journeys.

## Remediation status

The implementation recommendations in this audit were addressed in the codebase after the original observations:

- Search responses now separate marketplace compatibility matches from broad keyword fallbacks.
- Provider `EXACT` results are demoted when the listing title explicitly contradicts the selected make/model.
- Only compatibility matches can receive value badges, automatic quote selection, price-alert defaults, or repair guides.
- Repair guides require a short-lived server-signed proof tied to the exact vehicle, part, source, and listing.
- Generic timing-belt maintenance suggestions are suppressed until engine applicability can be confirmed.
- Comparison requires two listings.
- Search-method and account tabs now expose full tab/tabpanel semantics and keyboard navigation.
- Diagnosis, quote, photo, account-load, mileage, and repair-guide errors have clearer validation, announcements, and recovery actions.
- Account deletion clears all app-owned storage prefixes and has tested guards for cancellation, expired sessions, network errors, rapid taps, partial failures, and already-deleted users.
- Optional PostHog analytics is dynamically loaded, reducing the entry JavaScript chunk from roughly 572 kB to 363 kB.

External validation still required before release: a production-like Supabase deletion test, production provider/CORS verification, manual screen-reader/physical-keyboard testing, and deployed Core Web Vitals measurement. The scores below describe the audited baseline and should be rescored after those checks.

## Executive summary

CarPartsRadar has a polished, credible-looking interface and unusually helpful diagnostic flows. The vehicle picker, OBD validation, symptom analysis, editorial guides, legal pages, responsive layout, and most empty/error states are thoughtful and easy to use.

The product is not ready to make strong fitment or “best value” promises, however. In repeated live tests, a 2020 Toyota Camry search surfaced Honda, Mazda, Chrysler, Lexus, and other vehicle-specific parts. Some were labeled unverified, while other suspiciously unrelated titles were labeled “Verified fitment.” Unverified listings could still become “Recommended,” “Best Value,” and the basis for an AI repair guide. This is a critical purchase-safety and trust defect because fitment is the product’s central promise.

The best near-term strategy is not a visual redesign. It is to make the search fail closed: only evidence-backed matches belong in the primary results, every badge must expose its evidence, and unknown compatibility must never drive recommendations, quotes, maintenance kits, or repair instructions.

| Area | Score | Assessment |
| --- | ---: | --- |
| Overall UX | 7.0/10 | Fast and understandable, but the core result contract breaks under realistic searches. |
| UI | 8.6/10 | Modern, responsive, visually consistent, and well structured. |
| Trust | 4.0/10 | Strong presentation is undermined by incompatible-looking results and unsupported fitment claims. |
| Conversion | 6.1/10 | The funnel is clear, but incorrect recommendations create hesitation at the purchase decision. |
| Accessibility | 7.3/10 | Good labels and landmarks; dark-mode contrast and several ARIA/state-announcement gaps remain. |
| Performance | 7.2/10 | Stable local behavior, but searches took roughly three seconds and the main bundle is oversized. |

### Baseline verification

- `npm test`: 106 tests passed.
- `npm run lint`: passed.
- `npm run build`: TypeScript and Vite production build passed.
- Vite warned that the main JavaScript chunk is 570.99 kB minified and 181.49 kB gzip, above its 500 kB warning threshold.
- No browser console errors or warnings appeared during the tested landing, results, account, and editorial journeys.
- Supabase credentials are not configured in the local environment. The public auth form was exercised, but authenticated watchlist, account data, and account deletion could not be validated end to end.

## Highest-risk findings

### 1. Primary results can contradict the selected vehicle — Critical

Searching OEM number `04465-0K010` for a 2020 Toyota Camry returned 15 results dominated by Honda CR-V and Mazda CX-30 listings. The page said “Fitting your 2020 TOYOTA Camry” even though every visible result said “Fitment not verified.”

**Required fix:** Split provider output into evidence tiers before ranking:

1. Verified for this exact vehicle.
2. Possible match requiring user verification.
3. General keyword results.

Only tier 1 should appear under a “Fits your vehicle” heading. If tier 1 is empty, say so plainly and offer controlled fallback options.

### 2. Fitment badges do not require enough vehicle evidence — Critical

A Brake Pads search for the Camry showed a Chrysler 300 listing marked “Verified fitment,” plus several other suspiciously unrelated titles. Cross-platform part compatibility can be real, so title mismatch alone is not proof of incompatibility. It is, however, proof that the badge needs transparent, auditable evidence.

**Required fix:** Make `verified` impossible unless the provider’s structured compatibility data matches the complete selected vehicle identity. Store and display the matched year, make, model, trim, engine, provider evidence, and last-verified timestamp. Never infer verified fitment from title keywords or a partial vehicle match.

### 3. Unverified items can be recommended — Critical

The first unverified Honda result received “Best Value,” “Cheapest Deal,” and “Recommended.” A Honda Civic timing-belt kit also received “Recommended (Best Value)” from a Camry maintenance search.

**Required fix:** Treat unknown fitment as disqualifying. Unverified listings may be shown only in a separate fallback area and cannot receive recommendation, value, comparison-winner, or quote-selection badges.

### 4. Repair guidance is available for unverified parts — Critical

The detail modal warned that the Honda CR-V listing was not verified for the Camry, then offered “Generate AI Guide” for that Camry.

**Required fix:** Suppress repair-guide generation unless both the vehicle and part are verified. The guide endpoint must enforce this server-side rather than relying only on a disabled client button.

### 5. Maintenance kits are not gated by vehicle applicability — Critical

The selected Camry was offered a generic “Timing Service” that searched for a timing-belt/water-pump kit without engine-level applicability evidence. The resulting inventory was unrelated and unverified.

**Required fix:** Resolve maintenance operations from authoritative year/make/model/engine data. If applicability is unknown, omit the kit or label it as a general educational category—not a vehicle-specific recommendation.

## Persona reports

### Persona 1 — Professional mechanic

**Journey:** Landing → manual vehicle selection → OEM number search → results review → select listing → compare → listing detail → repair guide.

**Emotional path:** Interested → efficient → skeptical → frustrated → unwilling to rely on the result.

**Positive experiences**

- Searchable year/make/model controls are fast with a keyboard.
- OEM/part-number input supports a professional workflow.
- Cards expose price, shipping, condition, seller, and fitment state.
- The detail modal preserves the unverified warning.

**Pain points and confusing moments**

- “Fitting your Camry” conflicts with a page full of unverified Honda/Mazda listings.
- “Recommended” implies a safe choice even when fitment is unknown.
- “Compare Now” becomes available with one selected listing and opens a one-column comparison.
- The repair-guide action creates the impression that an unrelated part is suitable for the selected vehicle.

**Missing features**

- Full trim and engine identity.
- Provider fitment evidence and cross-reference details.
- Professional batch/OEM search.
- Saved vehicle profiles with notes.
- A clear split between exact application matches and general marketplace results.

**Trust concerns**

- A mechanic cannot audit why a result is considered compatible.
- Strong marketing language overstates the current data quality.
- Value rankings optimize price before compatibility is proven.

**Recommendations**

- Make verified fitment a hard precondition for recommendations.
- Add a “Why this fits” drawer with exact matched fields and source.
- Put exact/cross-reference part-number results in a separate workflow from vehicle catalog search.
- Require two listings before comparison.

**Overall satisfaction:** 4/10. The workflow is quick, but it would not replace a trusted catalog until compatibility evidence is reliable.

### Persona 2 — Everyday driver with limited automotive knowledge

**Journey:** Mobile landing → invalid VIN → manual vehicle → Brake Pads → OBD code → symptom diagnosis → instant quote → photo identification → maintenance kit.

**Emotional path:** Reassured → guided → confident → confused by mismatched parts → concerned.

**Positive experiences**

- The mobile progress indicator, VIN shortcut, and bottom navigation reduce intimidation.
- Invalid VIN handling is explicit and offers manual selection.
- `P03` is rejected as malformed; `P9999` is treated as unknown rather than invented.
- The `P0302` explanation is readable and useful.
- The grinding-brake symptom flow provides a prominent safety warning, likelihood, explanations, optional part selection, and a professional-inspection disclaimer.
- The quote says labor is excluded.

**Pain points and confusing moments**

- A novice is likely to trust “Verified fitment” and “Recommended” without questioning a Chrysler title on a Camry page.
- “Recommended replacement parts” after an OBD code sounds more diagnostic than the evidence supports.
- “Cheapest fitting listing per part” is too absolute while compatibility is uncertain.
- Photo identification showed the raw backend message “Origin not allowed.”
- Horizontal mobile filter/trust rows require lateral discovery and expose visible scrollbars.

**Missing features**

- Plain-language “why this fits” evidence.
- Vehicle trim/engine completion or VIN-derived specification confirmation.
- Confidence levels that distinguish symptoms, likely causes, and confirmed failed parts.
- A recovery path when photo analysis is unavailable.

**Trust concerns**

- The UI’s confidence is higher than the underlying evidence.
- A user with limited knowledge could buy an incompatible part or follow inappropriate repair guidance.

**Recommendations**

- Replace diagnostic certainty with “possible causes” and “parts commonly inspected.”
- Explain unknown fitment before showing marketplace fallbacks.
- Add visible recovery actions to photo errors: retry, choose another photo, or search by name.
- Make the full vehicle identity visible throughout purchase flows.

**Overall satisfaction:** 6/10. The guidance is excellent, but the user is especially vulnerable to the fitment defects.

### Persona 3 — Average user

**Journey:** Desktop landing → vehicle selection → common part search → sort/filter → empty results → dark mode → back/forward → reload → Watchlist → account forms → guides/legal pages.

**Emotional path:** Engaged → productive → mildly slowed by controls → reassured by stable navigation → uncertain at mismatched inventory.

**Positive experiences**

- Strong visual hierarchy and concise primary actions.
- Empty part input produces a useful inline alert and suggestions.
- A forced 399-character query was safely rejected by the application’s 60-character rule.
- Rapid double-clicking did not duplicate or crash the results view.
- Browser back, forward, and reload restored the selected vehicle and part search.
- Sorting and the zero-results filter state worked.
- Watchlist has a clear empty state and “Start Searching Parts” action.
- Guides and legal pages are substantial, consistent, and easy to find.

**Pain points and confusing moments**

- A one-item comparison feels unfinished.
- The dark-mode “Clear filters” action has approximately 1.57:1 contrast against its background.
- Mobile filter rows and badges add lateral scanning.
- Account-data request failures are internally converted into empty arrays, which can make a load failure look like “no data.”

**Missing features**

- More obvious distinction between exact results and broad marketplace matches.
- Loading progress that communicates provider status during slower searches.
- Consistent retry actions for recoverable AI/provider failures.

**Trust concerns**

- The average user notices mismatched titles quickly and may abandon before opening a detail view.

**Recommendations**

- Fix result integrity before adding more promotional UI.
- Improve dark-mode contrast and complete tab/tabpanel semantics.
- Show explicit account-data load errors.
- Split the main JavaScript bundle and lazy-load secondary flows.

**Overall satisfaction:** 7/10. The application feels modern and stable, but result relevance limits conversion.

## Page-by-page audit

| Page or flow | What works well | What does not | Severity | Recommended fix | Expected impact |
| --- | --- | --- | --- | --- | --- |
| Landing | Clear value proposition, polished hero, visible methodology and legal links, VIN/manual paths | “Every listing is checked” and “rare” unverified copy overstates observed behavior | High | Rewrite the promise until evidence-backed fitment is enforced | Reduces expectation mismatch and immediate trust loss |
| Vehicle and VIN | Good dependency states; invalid VIN has loading, alert, and fallback | Search identity stops before engine-level specificity in the tested manual flow | Critical | Require trim/engine where fitment depends on them; confirm VIN-derived specs | Fewer false matches |
| Part name / OEM | Supports common names and part numbers; good empty and length validation | Exact part-number search is mixed with broad marketplace fallback | Critical | Separate exact/cross-reference search from vehicle catalog matches | Faster, safer professional workflow |
| Maintenance kits | Scannable presets and quick search | Generic timing-belt workflow appeared without vehicle applicability evidence | Critical | Build kits from authoritative vehicle/engine rules; omit unknown operations | Prevents vehicle-inapplicable recommendations |
| OBD | Rejects malformed codes; does not fabricate unknown definitions; readable recognized-code state | “Recommended replacement parts” implies a component diagnosis | Medium | Use “possible causes” and “parts commonly inspected”; preserve diagnostic disclaimer near CTAs | Better novice comprehension |
| Photo identification | Upload and preview work | Local API returns raw “Origin not allowed”; no strong recovery route | High | Fix staging/production origin configuration and map errors to retry/search alternatives | Restores a promoted workflow |
| Symptoms and quote | Excellent vague-input coaching, safety warning, likelihood, part controls, labor disclosure | Error paragraphs lack `role="alert"`; “fitting” quote language is overconfident | Medium | Add live alerts and only quote verified matches | Safer, more accessible conversion path |
| Results and filters | Clear cards, sorting, filter chips, useful zero-results state, stable URL history | Incompatible-looking results, unverified recommendations, questionable verified badges | Critical | Evidence-tier pipeline; verified-only rankings; separate fallback section | Largest trust and conversion gain |
| Comparison | Clear matrix presentation | Enabled with one selection | Medium | Require two items or disable with “Select one more” helper text | Removes a dead-end interaction |
| Listing detail | Fitment warning remains visible | AI guide remains available for unverified listing | Critical | Enforce verified vehicle-part pairing in client and API | Prevents unsafe guidance |
| Repair guide | Structured guide and close action exist | Error state has no retry; unverified input can reach generation | Critical | Server authorization/validation plus retry for transient failures | Safety and recoverability |
| Watchlist | Helpful empty state and route back to search | Authenticated load failures can resemble an empty list | Medium | Distinguish empty, loading, permission, stale session, and network errors | Less silent failure |
| Auth and account | Blank/invalid form errors are announced; account-deletion UI exists in source inventory | End-to-end account deletion was not testable without Supabase | High, unverified | Run a staging test with real session expiry, rapid taps, partial deletion, and already-deleted states | Required release confidence |
| Guides | Substantial, cautious content with source/scope notes | No critical issue observed | Low | Add contextual links from uncertain search states | Converts uncertainty into useful education |
| Methodology / About / Contact / Privacy / Terms / Disclosure | All pages load, have headings, skip links, and consistent footer access | Continue checking dates and claims during releases | Low | Add content-owner and review-date process | Maintains credibility |
| Dark mode | Theme toggles and overall palette works | “Clear filters” contrast is about 1.57:1 | High | Use an AA-compliant foreground/background combination; target at least 4.5:1 | Removes a concrete accessibility barrier |

## Accessibility review

### Verified strengths

- Landing semantic scan found one main landmark, one footer, logical H1/H2/H3 structure, no duplicate IDs, no unlabeled form controls, no untitled buttons, and no images missing alternative text.
- Results scan also found no untitled buttons, missing image alt text, or duplicate IDs.
- Invalid VIN, malformed OBD code, unknown OBD code, and empty part input used alert semantics.
- Global styles include visible focus treatment.
- Touch targets and mobile typography are generally comfortable.

### Gaps

- Dark-mode “Clear filters” contrast is approximately 1.57:1, below the WCAG AA 4.5:1 target for normal text.
- Part-mode tabs expose `aria-selected` but lack complete `aria-controls` and `tabpanel` relationships.
- Symptom and quote errors are not consistently announced with `role="alert"` or a live region.
- Mileage can become undefined without clear validation feedback.
- Keyboard Tab movement could not be reliably reproduced through the browser automation layer, so a physical keyboard/manual screen-reader pass remains required.

## Deliberate break and resilience tests

| Test | Result |
| --- | --- |
| Invalid 17-character VIN | Passed: loading and friendly manual fallback |
| Malformed OBD `P03` | Passed: explicit format error |
| Unknown valid-format OBD `P9999` | Passed: no fabricated definition |
| Empty part search | Passed: inline alert and suggestions |
| Forced 399-character part input | Passed: rejected at 60-character boundary |
| Rapid double-click on part suggestion | Passed: no duplicate/crash observed |
| Browser back and forward | Passed: query state restored |
| Page refresh on results | Passed: search restored |
| Multiple tabs | Passed: independent routes remained stable |
| Filter to zero listings | Passed: dedicated empty state and clear action |
| Blank and invalid auth forms | Passed at client-validation layer |
| Photo upload | Failed locally: preview followed by raw origin-policy error |
| Authenticated deletion | Not verified: staging Supabase configuration unavailable |
| True network disconnect / throttling | Not verified: browser tooling did not expose network emulation |
| Full keyboard and screen-reader journey | Not verified: requires manual assistive-technology pass |

## Prioritized improvement backlog

### Critical — fix immediately

1. Enforce exact, structured compatibility before a result can be “Verified fitment.”
2. Separate verified matches from unverified keyword fallbacks.
3. Prevent unverified results from receiving Recommended, Best Value, Cheapest Deal, comparison-winner, or quote-selection status.
4. Block repair-guide generation for unverified vehicle-part pairs in both UI and API.
5. Gate maintenance kits using vehicle and engine applicability.
6. Add provider-contract tests with known mismatched titles, incomplete fitment data, and empty verified sets.

### High impact

1. Add trim and engine to the persistent vehicle identity, or resolve and confirm them through VIN.
2. Add a “Why this fits” evidence drawer with provider, matched fields, coverage level, and timestamp.
3. Fix photo-analysis origin configuration and convert raw backend errors into user-friendly recovery actions.
4. Make hero and quote copy accurately distinguish verified from possible matches.
5. Fix dark-mode action contrast.
6. Run the complete authentication and deletion suite against a production-like staging project.

### Medium

1. Require at least two selected items before enabling comparison.
2. Add proper tab/tabpanel ARIA wiring and keyboard arrow behavior.
3. Announce symptom, quote, account, and repair-guide errors consistently.
4. Add Retry to repair-guide and provider failure states.
5. Distinguish account load failures from legitimate empty data.
6. Add explicit mileage validation.
7. Split/lazy-load the oversized main bundle.
8. Improve horizontal-scroll affordances without visible scrollbar clutter.

### Low

1. Add explicit first-use empty copy for Garage and Recent Searches instead of omitting the sections.
2. Add small tooltips for OEM number, fitment evidence, seller score, and diagnostic confidence.
3. Add contextual guide links when no verified match exists.
4. Add content review dates to editorial methodology pages.

## Feature recommendations

| Feature | Why it helps | Personas | Complexity | Expected impact |
| --- | --- | --- | --- | --- |
| Fitment evidence drawer | Makes every compatibility claim auditable | All, especially mechanic | Medium | Very high trust gain |
| Complete vehicle profile | Captures trim/engine/VIN-derived details required for exact fitment | All | Medium–High | Very high accuracy gain |
| Verified-only default results | Prevents broad marketplace results from masquerading as fitting inventory | All | Medium | Very high safety and conversion gain |
| Part-number cross-reference mode | Gives mechanics exact and equivalent results without mixing catalog semantics | Mechanic | Medium | High professional utility |
| Diagnostic confidence ladder | Separates symptom, possible cause, inspection target, and confirmed failure | Novice, average | Medium | High safety and comprehension |
| Provider eligibility / return-protection badge | Communicates buyer protection only when actually available | All | High | High trust gain |
| Saved professional garage | Supports multiple vehicles, notes, and repeat searches | Mechanic | Medium | Medium retention gain |
| Provider status during loading | Shows which marketplace is pending or unavailable | Average, mechanic | Low–Medium | Medium perceived-performance gain |

## Competitive analysis

CarPartsRadar’s visual design compares well with established automotive shopping products, but leading catalogs are more conservative about fitment:

- **eBay Guaranteed Fit** asks buyers to enter the complete vehicle and marks eligible items with a specific check. eBay’s seller documentation states that Car & Truck shoppers provide year, make, model, trim, and engine, and listings without fitment data are not eligible. CarPartsRadar currently makes strong claims with a less complete tested vehicle identity. Sources: [eBay Guaranteed Fit](https://pages.ebay.com/motors/ebay-guaranteed-fit/) and [eBay Seller Center](https://www.ebay.com/sellercenter/protections/ebay-guaranteed-fit).
- **RockAuto** separates part-number search from vehicle-catalog verification and explicitly recommends using its catalog to confirm application details. CarPartsRadar currently blends broad keyword/part-number results into a page framed as fitting one vehicle. Sources: [RockAuto Help](https://www.rockauto.com/help/?page=1) and [RockAuto Part Search](https://www.rockauto.com/en/partsearch/).
- **AutoZone** asks for year, make, model, and engine for exact-fit browsing and also offers VIN lookup to resolve specifications. CarPartsRadar’s VIN shortcut is directionally strong, but the manual flow needs equivalent specificity before guarantee-like language is safe. Source: [AutoZone Parts](https://www.autozone.com/parts).

Patterns worth adopting:

1. Persist the complete selected vehicle at the top of every results and checkout-adjacent screen.
2. Make compatibility an evidence-backed eligibility state, not a ranking score.
3. Keep exact catalog matches separate from broad search.
4. Expose return protection and provider guarantees only when the specific listing qualifies.
5. Convert “no verified matches” into an honest, useful state rather than filling the primary list with uncertain inventory.

## Final roadmap

### Phase 1 — Immediate safety and trust

1. Quarantine unverified results from the fitting list.
2. Remove recommendation/value badges from uncertain inventory.
3. Block repair guides and quotes unless vehicle-part fitment is verified.
4. Gate maintenance kits by vehicle applicability.
5. Fix photo-origin handling and dark-mode contrast.
6. Require two selections for compare.
7. Add regression fixtures for the Camry/Honda/Chrysler mismatch scenarios.

### Phase 2 — Next sprint

1. Add trim/engine/VIN-resolved vehicle profiles.
2. Ship “Why this fits” evidence and fitment-source logging.
3. Complete tab semantics, live error announcements, mileage validation, and account-load errors.
4. Add retry and provider-status UX.
5. Split the main bundle and measure Core Web Vitals on a deployed staging build.
6. Run the full account deletion, stale-session, network, rapid-tap, and already-deleted test suite in staging.

### Phase 3 — Future differentiation

1. Build a professional part-number and cross-reference workspace.
2. Add multi-vehicle garages and shop notes.
3. Introduce diagnostic confidence stages and inspection checklists.
4. Integrate listing-specific fitment guarantees and return eligibility.
5. Add monitored fitment-quality metrics: verified-result rate, disputed-fit rate, fallback exposure, and provider disagreement.

## Release recommendation

Do not market CarPartsRadar as guaranteeing fitment or allow AI repair instructions to use marketplace results until the Phase 1 guards are implemented and tested with production-like provider payloads. The interface itself is close to premium quality; the path to a substantially better product is data-contract integrity, not more surface polish.

## Evidence

- `screenshots/01-landing-desktop.png` — desktop landing page.
- `screenshots/02-mechanic-oem-results.png` — Camry OEM search with unverified Honda/Mazda inventory and recommendation badges.
- `screenshots/03-unverified-detail-repair-guide.png` — unverified listing detail.
- `screenshots/04-landing-mobile.png` — 380 × 844 mobile landing.
- `screenshots/05-mobile-results-fitment.png` — mobile Camry results with suspiciously unrelated fitment labels.
- `screenshots/07-mobile-maintenance-mismatch.png` — Camry maintenance flow returning unverified Honda timing kits.
- `screenshots/08-guides-desktop.png` — editorial guide hub.
- `screenshots/09-dark-mode-results.png` — dark-mode empty state and low-contrast clear action.
