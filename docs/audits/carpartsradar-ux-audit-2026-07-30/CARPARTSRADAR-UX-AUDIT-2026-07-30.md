# CarPartsRadar UX, QA, CRO, and accessibility audit

Audit date: July 30, 2026  
Target tested: local application at `http://127.0.0.1:5199/`  
Personas: professional mechanic, everyday driver, average user  
Method: direct browser interaction at desktop and explicit 390 x 844 mobile viewport, deliberate invalid-input and navigation testing, public-page review, console inspection, and a bounded Luna mobile QA pass. No source files were changed during this audit.

## Executive summary

CarPartsRadar now presents a coherent, polished product shell. The strongest parts are the plain-language vehicle-to-part journey, the transparent fitment language, the OBD-II and symptom entry points, the responsive bottom navigation, the editorial trust pages, and the recent accessibility fixes.

The most important remaining issue is not visual: the app accepts an unsupported-looking code such as `P9999` and presents replacement-part recommendations as though the code were known. That can lead users to buy unnecessary parts. The second major issue is environment/API resilience. In this local audit, the frontend was receiving HTML from the configured API port, then surfaced the raw JSON parser error `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` to users. The API port was occupied by another local application, so live marketplace results and normal vehicle-data loading could not be verified end to end.

### Scores

| Dimension | Score | Assessment |
|---|---:|---|
| Overall UX | 7.0/10 | Clear guided experience with good recovery states, reduced mobile friction, and a serious diagnostic-code trust gap |
| UI | 7.5/10 | Strong visual identity and hierarchy; mobile tab/input presentation still needs polish |
| Trust | 6.5/10 | Good fitment/disclosure language, reduced by unsupported DTC recommendations, one-source coverage, and raw API errors |
| Conversion | 6.2/10 | Strong search and empty-state CTAs; conversion is interrupted when vehicle/results APIs fail or only one listing is available |
| Accessibility | 7.0/10 | Landmarks, names, validation, file input, and mobile navigation are improved; tab semantics and deeper keyboard testing remain |
| Performance | 7.0/10 | Local transitions felt responsive and console-clean; the main bundle remains large and API response timing was not validly measurable |

### Highest-priority findings

1. **High — unsupported DTC codes are treated as actionable diagnoses.** `P9999` produced “OBD-II Diagnostic Code P9999” and recommended spark plugs, ignition coils, oxygen sensors, and a mass-airflow sensor. Unknown codes should produce an uncertainty state, not a parts list.
2. **High — API failures leak an implementation error.** When the configured API port returned HTML, the results page showed `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Users need a plain-language outage message with retry and a support path.
3. **High — the local environment prevented the primary vehicle and marketplace workflows from being verified normally.** The landing page displayed “Couldn't load vehicle data — check your connection and try again,” and results could not load. Confirm the deployed frontend points to the intended CarPartsRadar API before release.
4. **Medium — only a successful known DTC path was verified.** `P0302` correctly produced a cylinder-2 misfire explanation and component shortcuts, but the UI should distinguish “recognized code” from “possible causes” and link users to a confirmation step.
5. **Medium — mobile tab presentation is discoverable but visually clipped by design.** The 390px screenshot shows `Error Code (OBD-I...` at the edge of the horizontal tab row. The “Swipe the tabs” helper is useful, but a more explicit tab scroller or compact “Search by” menu would reduce hesitation.
6. **Medium — the main JavaScript bundle remains over 500 kB after minification.** This is not a functional failure, but it can slow first use on mobile connections.

## Test environment and evidence

### Confirmed browser measurements

| Check | Result |
|---|---|
| Desktop viewport | 1440px outer viewport; 1430px document client width; no horizontal overflow |
| Mobile viewport | 390px outer viewport; 380px document client width; no horizontal overflow |
| Mobile primary navigation | Search, Watchlist, and Account all opened their intended views |
| Desktop primary navigation | Watchlist and Account opened their intended views after transition settled |
| Browser console | No warnings or errors captured in the audited mobile and desktop tabs |
| Static pages | Guides, Methodology, About, Contact, Privacy, Terms, and Affiliate Disclosure all loaded with an H1 and no horizontal overflow |
| Multiple tabs | A home tab and a results tab retained separate URLs and titles |

### Important limitation

The frontend's Vite proxy was configured for port 3001, but that port was occupied by another local application during this audit. As a result, the CarPartsRadar UI received HTML instead of JSON from `/api/*`. This blocked end-to-end verification of live vehicle makes/models, marketplace results, watchlist price refreshes, quotes, and normal successful account/API submissions. It is a release-blocking environment verification item, not evidence that the production API is definitely broken.

## Persona 1 — Professional mechanic

Satisfaction: **7.0/10 when the API is healthy; 5.5/10 in the observed local failure state**

### Journey map

| Stage | Behavior | Reaction | Friction |
|---|---|---|---|
| Start | Looks for VIN or year/make/model entry | Fast, familiar entry choices | Vehicle data failed in the test environment |
| Identify | Uses OEM/part-name, OBD-II, or symptom search | Multiple technical entry points are valuable | No engine/position/filter depth was available before results |
| Validate | Checks fitment, seller, shipping, and condition | Fitment language is more trustworthy than a generic catalog | Unsupported `P9999` code received recommendations |
| Compare | Wants multiple sellers and total acquisition cost | Result hierarchy is promising | Live results were blocked; one-source coverage remains a product risk from prior evidence |
| Decide | Opens details or repair guide | Seller and fitment context help | No authoritative service-data source is visible for repair specifications |

### Positive experiences

- VIN is positioned as the fastest path.
- Part search explicitly mentions OEM numbers.
- OBD-II and symptom entry are useful shortcuts for a working technician.
- Fitment, seller, shipping, condition, and retailer handoff are grouped in a useful result model.
- Methodology and disclosure pages support a more credible comparison experience.

### Pain points and trust concerns

- A mechanic cannot rely on a diagnostic workflow that invents confidence for an unknown code.
- A price-comparison product needs meaningful coverage or an explicit statement of how many sources were checked.
- The raw JSON parser message exposes implementation detail and makes the product look broken.
- No visible engine, drivetrain, position, brand, interchange, warranty, core-charge, or local-pickup filters were available in the tested part flow.
- AI repair guidance needs source provenance and must not provide approximate safety-critical specifications.

### Recommendations

- Maintain a recognized-DTC allowlist or authoritative code catalog. Unknown codes should say: “We don’t recognize this code yet. Confirm it with the vehicle manufacturer or a qualified technician.”
- Add a coverage meter: marketplaces checked, listings found, verified-fitment count, and refresh time.
- Add mechanic filters for position, engine, drivetrain, brand, interchange number, warranty, core charge, and delivery/pickup.
- Show a fitment-evidence drawer and cite service-data sources for repair instructions.
- Add a compact keyboard-first “Pro mode” after the consumer workflow is stable.

## Persona 2 — Everyday driver with limited automotive knowledge

Satisfaction: **7.0/10 for the visible workflow; 5.5/10 when vehicle/results APIs fail**

### Journey map

| Stage | Behavior | Reaction | Friction |
|---|---|---|---|
| Start | Reads the headline and chooses VIN or manual vehicle entry | The promise is easy to understand | The failed vehicle-data state stops progress |
| Choose part | Taps a popular part or switches search method | Popular chips reduce intimidation | OEM, OBD-II, fitment, and kit terminology still need help text |
| Diagnose | Enters a known DTC or describes a symptom | P0302 explanation and symptom presets are reassuring | P9999 looks authoritative even though it is unsupported |
| Compare | Scans price and fitment | Clear fitment language helps | Raw API errors and one-source uncertainty reduce confidence |
| Buy | Uses retailer handoff | The external purchase boundary is clear | Return, warranty, and marketplace protection are not summarized at decision time |

### Emotional reactions

- **Reassured** by “Parts that fit” and the VIN-first guidance.
- **Curious** about Photo Search and problem description.
- **Confused** by OBD-II, OEM, and “kit” terminology without inline definitions.
- **Likely to abandon** after the vehicle-data error or the raw results parser error.

### Recommendations

- Add small “What is this?” helpers beside OEM number, OBD-II, fitment, core charge, and seller rating.
- Label diagnostic output as “possible causes,” not a diagnosis, and show one safe confirmation step.
- For unknown codes, explain that the app cannot safely recommend parts.
- Show retailer return/warranty information before the user leaves the app.
- Use a coverage message such as “We found 1 listing from 1 marketplace” instead of leaving the user to infer availability.

## Persona 3 — Average user

Satisfaction: **7.2/10 desktop; 6.4/10 mobile**

### Journey map

| Stage | Behavior | Reaction | Friction |
|---|---|---|---|
| Start | Uses bottom navigation or a recent search | Modern and easy to orient | The landing form is blocked when vehicle data fails |
| Search | Taps a popular part or tab | Fast, readable, and visually polished | The horizontal method row requires swiping on mobile |
| Recover | Uses Watchlist empty state or Back to Search | Recovery CTA is clear | Result API errors are too technical |
| Decide | Looks for a price and fitment signal | Visual hierarchy is strong | Comparison value is uncertain when coverage is low |

### What feels modern

- Strong condensed display typography and restrained color system.
- Persistent mobile navigation.
- Clear progress indicator from vehicle to part to prices.
- Popular-part chips and consumer-friendly symptom presets.
- Accessible names on the main actions and a usable file-upload control.

### What feels slower or less polished

- The API failure state takes the user from a promising loading state to a technical parser error.
- A tab row with five methods is difficult to scan on a narrow screen.
- The main bundle warning suggests unnecessary first-load cost.
- The kit result heading visually reads as `Brake Pad and Rotor KitKit search` in the accessibility text because the badge is adjacent to the title without a separator.

### Recommendations

- Replace raw errors with one sentence, one Retry button, and an optional “Check service status” link.
- Use a compact “Search by” control or make the horizontal tab affordance stronger.
- Put total price, fitment, and arrival in the first scan row; collapse secondary badges on mobile.
- Add an explicit space/visual separator between the result title and the “Kit search” badge.

## Page-by-page audit

Severity uses Critical, High, Medium, and Low. Impact describes expected user or business benefit after correction.

| Page/state | What works | Problems found | Severity | Recommended fix | Estimated impact |
|---|---|---|---|---|---|
| Landing / vehicle selection | Clear H1, progress indicator, VIN/manual paths, fitment promise, trust copy | Vehicle data failed in the test environment because the frontend proxy did not reach the intended API | High release risk / environment | Verify production API origin and add a deploy smoke test for `/api/makes` and `/api/models` | Restores the primary activation funnel |
| Landing / mobile | 390px viewport had no document overflow; headline and form remained within the page; bottom nav stayed visible | The three confidence chips form a horizontally clipped visual row on narrow screens, though the document itself does not overflow | Low/Medium | Allow the chip group to wrap or use a small scroll affordance | Improves first-impression clarity |
| VIN entry | Accessible name, 17-character guidance, I/O/Q explanation, disabled Decode until input is valid | Invalid input is not visibly explained until the user understands the helper; decode success/engine formatting needs real API verification | Medium | Keep the inline rule adjacent to the field and round engine values in success copy | Fewer failed attempts and more trust |
| Manual vehicle lookup | Year/make/model/trim structure is understandable and Continue is disabled until complete | Normal options could not be tested because vehicle data did not load | High release risk / blocked | Add API contract smoke tests and a clearer retry state | Enables all non-VIN users |
| Part selection | Selected vehicle stays visible; five entry modes; popular parts; clear helper text | Mobile tab labels are clipped at the right edge; “Swipe the tabs” is present but easy to miss | Medium | Use a stronger scroll indicator or compact mode selector; add `aria-controls` and a tab panel relationship | More discovery and fewer missed features |
| Custom part search | OEM example, free text, max length, keyboard combobox behavior | End-to-end result submission was blocked by the API; 60-character UX limit should be paired with a visible counter for long custom terms | Low/Medium | Add a character counter only once the field is long; preserve honest API errors | Fewer invalid requests |
| Maintenance kit searches | Six choices render, descriptions now honestly say a combined kit may not exist, and component fallback exists in code | Kit result could not reach a real inventory/no-result state; API failure showed the generic raw parser error | High | Verify kit inventory against the correct API and test component fallback with fixture data | Prevents dead-end purchase intent |
| OBD-II recognized code | `P0302` rendered a useful cylinder-2 explanation and replacement shortcuts | Good recognized-code behavior, but no authoritative source/confirmation test is shown | Medium | Add “possible cause” language, source/coverage, and a safe confirmation step | Reduces wrong-part purchases |
| OBD-II unknown code | Field validation correctly rejected `XYZ`; `aria-invalid` and linked error were confirmed | `P9999` was accepted as a known code and generated recommendations | **High** | Validate against a known code catalog; unknown codes must show an uncertainty state and no parts list | Safety and trust protection |
| Photo Search | File input has a name, image accept list, descriptive help, and camera capture behavior | No upload was submitted; privacy/retention wording is brief and confidence/correction behavior remains unverified | Medium | Add image retention/privacy details, confidence, crop guidance, and manual correction | Safer and more usable activation |
| Describe a Problem | Presets are plain-language and easy to understand | API diagnosis/quote success could not be exercised in this environment; avoid presenting symptom matches as confirmed diagnoses | Medium | Keep “possible cause” language and show verification steps | Confidence without overclaiming |
| Results loading | Loading status appears immediately and the URL preserves the selected vehicle/part | The result API did not return JSON in the local environment | High release risk / blocked | Add API smoke tests and monitor the exact production origin | Restores purchase funnel |
| Results error | Retry button and a clear “couldn't complete” heading exist | Raw parser error is shown: `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` | **High** | Normalize fetch/parser errors to “We couldn't load prices. Check your connection and try again.” Log technical details only to telemetry | Large reduction in abandonment/support confusion |
| Results with one listing | Prior implementation now suppresses comparative superlatives when fewer than two visible results | Live one-listing behavior could not be rechecked because the API was blocked | Medium | Add explicit source coverage and test one-result fixture | Preserves trust in comparison promise |
| Listing details | Prior implementation has seller, shipping, fitment, complementary parts, watchlist, and retailer actions | Live detail dialog could not be opened without a result; nested AI dialog/focus behavior needs physical keyboard/VoiceOver validation | Medium | Add fixture-driven dialog tests and verify focus trap/restoration | Better decision confidence |
| AI repair guide | Loading status, 20–30 second expectation, cancel-on-close behavior, and safety language are present in code | Real AI generation was not exercised in this run; authoritative source provenance remains absent | High | Omit approximate torque/spec values unless sourced for the exact vehicle; show source and safety boundary | Reduces safety and liability risk |
| Watchlist | Empty state is direct, includes “Start Searching Parts,” and mobile navigation opens it reliably | Price refresh and populated list could not be tested without live results | Low/Medium | Add fixture-driven populated watchlist test and explain last refresh | Better retention after saving |
| Account / sign-in | Google and email paths, visible field labels, field-level errors, and responsive layout | Successful auth, rate limit, expired session, and logout cannot be tested without real credentials/API | Medium / blocked | Add staging auth fixtures, password-reset link, and status-specific error copy | Fewer failed account attempts |
| Account / sign-up | Empty submit shows email/password errors; invalid email and weak password are caught; password rule is visible before submit | Switching between Sign In and Create Account preserves entered values, which may confuse users and retain invalid text | Low/Medium | Clear mode-specific fields/errors on mode change or explain the preservation behavior | Less form hesitation |
| Mobile navigation | Search, Watchlist, and Account each opened the correct content at 390px; no overflow | The earlier audit found a Search/account state inconsistency; current direct test passed, but keep a regression test | Medium regression risk | Add a navigation-state test asserting active tab and content are atomic | Prevents orientation regressions |
| Guides index | H1, skip link, clear categories, footer navigation, and no overflow | Author/reviewer/date/source credentials are not prominent | Low/Medium | Add author, review date, sources, and editorial standard | Stronger SEO and affiliate trust |
| Methodology | Explains fitment, ranking, and data boundaries | Public identity and support email should look more professional | Medium | Use a branded support/editorial address and identify the publisher | Improves credibility |
| About / Contact | Purpose and correction path are clear | Limited company/team identity and response expectation | Medium | Add publisher identity, response time, and jurisdiction where appropriate | More trust before outbound clicks |
| Privacy / Terms / Affiliate Disclosure | Pages load, are linked, and cover core public disclosures | Processor inventory and retention claims should be checked against deployed behavior | Low/Medium | Add revision dates and maintain a processor/retention checklist | Compliance confidence |
| Loading/empty/success states | Loading status, empty Watchlist, DTC success, and form errors were observable | API outage error is not user-friendly; offline testing was unavailable | High | Add outage-specific copy, retry/backoff, and offline guidance | Better recovery and lower abandonment |

## Accessibility review

### Confirmed strengths

- Main content, header, footer, and navigation landmarks are present.
- Header and mobile navigation actions have accessible names.
- Photo Search exposes a file input named “Take or upload a photo of the car part,” accepts common image types, and links to descriptive help.
- DTC errors expose `aria-invalid="true"`, `aria-describedby`, and a `role="alert"` message.
- Sign-in and sign-up errors are visible as alerts and the fields carry programmatic descriptions.
- The part combobox opens with Arrow Down and exposes a listbox; Escape closes the open interaction.
- No browser console warnings or errors were captured.

### Remaining accessibility work

- Add `aria-controls` and an explicit tab-panel relationship to the five method tabs.
- Make the horizontal mobile tab affordance more obvious than helper text alone.
- Test dialog focus trap, Escape, focus restoration, and screen-reader announcements with real VoiceOver/TalkBack.
- Test reduced motion and dark-mode contrast with automated tooling.
- Add axe or equivalent automated accessibility checks to CI.
- Ensure unknown DTC errors are equally clear to screen-reader and sighted users.

## Intentional break-test results

| Attack/test | Result | Assessment |
|---|---|---|
| Blank sign-in | Email and password alerts appeared | Pass |
| Invalid email / short password | Field-level errors appeared | Pass |
| `XYZ` DTC | Format error appeared and was linked | Pass |
| `P9999` DTC | Recommendations appeared despite code being unsupported-looking | **Fail — High** |
| Known `P0302` DTC | Recognized explanation and replacement shortcuts appeared | Pass with trust-language recommendation |
| Clear DTC with keyboard select-all/backspace | Value and recommendations cleared | Pass |
| 61-character part URL | Route stayed in part-selection rather than accepting an oversized result query | Pass |
| Rapid method-tab clicks | No corrupted state or console errors observed | Pass |
| Refresh on direct result URL | URL and route persisted | Pass; API content remained blocked |
| Back navigation | Returned to the prior route | Pass |
| Multiple tabs | URLs and document titles remained isolated | Pass |
| API/network failure | Loading transitioned to an error state, but raw parser detail leaked | **Fail — High** |
| Offline mode | Not available through the controlled browser | Unverified |
| Real auth/OAuth/alert submission | Not run; would create external side effects and required credentials | Unverified |
| Real photo upload | Not run; no personal file was needed for this audit | Unverified |

## Improvement backlog

### Critical

- Treat unknown diagnostic codes as unknown; never generate a parts list from an unverified code.
- Verify the deployed frontend/API origin before release. The primary vehicle and results workflows must not point at the wrong service.

### High impact

- Normalize all fetch and JSON-parse failures into user-friendly, localized UI messages.
- Add a known DTC catalog and source/confirmation guidance.
- Add fixture-driven tests for results, kit no-results, one-result, multi-result, quote, and populated watchlist states.
- Add a source coverage meter and clearly describe one-source/zero-source conditions.
- Add authoritative service-data provenance and remove approximate safety-critical specifications from AI output.
- Add CI smoke tests for `/api/makes`, `/api/models`, `/api/search`, `/api/diagnose`, and `/api/quote` against the deployed origin.

### Medium

- Add `aria-controls`/tab panels and improve the mobile tab scroller affordance.
- Add helper text for OEM, OBD-II, fitment, seller rating, and core charge.
- Add mechanic filters for engine, drivetrain, position, brand, interchange, warranty, and core charge.
- Add branded publisher/support identity to public pages.
- Add a screenshot regression matrix at 320, 360, 390, and 430px widths.
- Add VoiceOver/TalkBack manual test scripts.

### Low

- Improve the kit badge spacing so the accessible result heading is not concatenated.
- Add author/reviewer dates and source links to guides.
- Add visible loading time estimates and reduced-motion polish.
- Split the main bundle further after measuring real mobile impact.

## Feature recommendations

| Feature | Why it helps | Personas | Complexity | Expected impact |
|---|---|---|---|---|
| DTC confidence and source drawer | Shows whether a code is recognized, what it means, and what to test next | All, especially mechanic | Medium | High safety/trust impact |
| Marketplace coverage meter | Explains how many sources and verified listings were checked | All | Medium | High conversion/trust impact |
| Fitment evidence drawer | Makes year/trim/engine matching inspectable | Mechanic, average user | Medium | High confidence impact |
| Beginner decision assistant | Defines terms and asks front/rear/engine/position questions | Everyday driver | Medium | High completion impact |
| Inventory-aware repair bundles | Builds a verified component list when no true kit exists | All | High | High purchase-intent impact |
| Pro garage/work-order mode | Stores multiple vehicles, notes, interchange data, and exportable part lists | Mechanic | High | High retention impact |
| Local pickup and total acquisition cost | Combines price, shipping, tax/core/return context, and pickup | All | High | High conversion impact |
| Guided photo capture | Adds framing examples, privacy, confidence, and manual correction | Everyday driver | Medium | Medium/high activation impact |

## Competitive analysis

CarPartsRadar's guided symptom and diagnostic entry is more approachable than a traditional catalog, but leading automotive experiences make deeper guarantees and purchasing context explicit.

- **RockAuto-style catalog depth:** year/make/model/engine navigation, part-number lookup, position, and application detail. CarPartsRadar should retain its simpler entry while adding engine/position/interchange depth.
- **eBay Motors-style Garage and protection:** saved vehicle specificity and clear fitment/return protection. CarPartsRadar should explain which retailer guarantee applies before the outbound click.
- **AutoZone-style support layer:** store pickup, warranty, diagnostics, loaner tools, and repair-help escalation. CarPartsRadar can differentiate as an independent comparison layer while aggregating warranty, returns, pickup, and qualified-help options.
- **Consumer product patterns:** leading products show one primary action, use progressive disclosure, expose delivery/returns before commitment, and never hide uncertainty behind a confident label.

Patterns CarPartsRadar should borrow:

- Named multi-vehicle garage with engine-level specificity.
- Honest coverage and fitment evidence.
- Brand/position/specification filters.
- Warranty, returns, core charge, pickup, and delivery before leaving the app.
- Source provenance for diagnostic and repair guidance.
- Mobile cards optimized for one-thumb scanning.

## Final roadmap

### Phase 1 — immediate release protection

1. Block unknown DTC recommendations and add recognized-code/source states.
2. Fix API origin configuration and add deployed-origin smoke checks.
3. Replace raw parser errors with plain-language outage/retry states.
4. Add result/kit/watchlist fixture tests so the core purchase funnel can be tested without live marketplace data.
5. Add mobile visual regression tests and confirm 320–430px layouts.

### Phase 2 — next sprint

1. Add coverage meter and meaningful one-result/zero-result explanations.
2. Add mechanic filters and beginner contextual help.
3. Add tab-panel semantics, stronger mobile tab affordance, axe checks, and VoiceOver/TalkBack scripts.
4. Add AI source provenance, timeout/cancel/retry handling, and exact-spec boundaries.
5. Improve publisher identity and public editorial metadata.

### Phase 3 — future differentiation

1. Pro garage/work-order workflow.
2. Local inventory and total acquisition cost.
3. Authoritative service-data integration.
4. Guided photo identification with confidence and correction.
5. Shareable quotes, repair lists, and price-history insights.

## Final validation record

Completed in the browser:

- Desktop landing, account, watchlist, part selection, kits, DTC, photo, symptom, results loading/error, static editorial/legal pages.
- Mobile landing, bottom navigation, direct vehicle/part route, part method tabs, keyboard combobox behavior, invalid/known/unknown DTC, Photo Search accessibility, refresh, back, and multiple-tab isolation.
- Deliberate blank forms, invalid email/password, invalid VIN input, long part URL, rapid tab interaction, unknown DTC, refresh/back, and API failure.
- Browser console inspection on mobile and desktop: no warnings or errors captured.
- Luna independently completed a read-only mobile smoke pass and reported no source changes.

Not completed because it would require credentials, real external effects, or unavailable browser controls:

- Successful OAuth/email account creation, real account login/logout, password reset, alert submission, and purchase checkout.
- Live marketplace results, populated watchlist, quote, and normal vehicle lookup while the configured local API port was occupied by another application.
- Offline network toggling.
- Uploading a personal image.
- VoiceOver/TalkBack and axe scans.

The app is visually close to a polished consumer product, but the unknown-DTC behavior and API-origin/error handling should be resolved before treating the release as production-ready.
