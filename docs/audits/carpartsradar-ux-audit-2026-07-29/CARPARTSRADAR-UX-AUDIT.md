# CarPartsRadar three-persona UX, CRO, QA, and accessibility audit

Audit date: July 29, 2026  
Production target: <https://carpartsradar.com/>  
Method: direct interaction with the live production application at desktop, responsive, and explicit 390 × 844 viewports; deliberate invalid input and rapid-click testing; editorial/trust-page review; source-map review; production build and automated tests.

> Screenshot note: fixed headers can appear more than once in tall full-page captures because of browser screenshot stitching. That repetition is not reported as a product defect.

## Executive summary

CarPartsRadar has a compelling concept and a notably polished desktop shell. Vehicle selection, VIN decoding, plain-language symptom diagnosis, transparent fitment labels, seller data, and editorial disclosures establish a credible base. The guided symptom-to-parts experience is the strongest differentiator.

The current release is not yet a consistently premium experience. Mobile results are materially clipped, a malformed search can permanently widen the mobile home page until history is cleared, and a common brake-pad search produced only one retailer listing. Those issues attack the product’s three core promises: mobile usability, resilience, and price comparison.

| Dimension | Score | Summary |
|---|---:|---|
| Overall UX | 6.0/10 | Excellent guided concepts, but important mobile and dead-end failures |
| UI | 6.5/10 | 8/10 desktop; approximately 4/10 on narrow results screens |
| Trust | 6.5/10 | Strong disclosures and fitment language; thin inventory and approximate AI repair data reduce confidence |
| Conversion | 4.5/10 | Clear calls to action, but one-result “comparison,” empty kits, and mobile clipping interrupt purchase intent |
| Accessibility | 5.5/10 | Semantic headings/landmarks and many accessible names; upload, validation, and custom interactive controls need work |
| Performance | 6.5/10 | Normal navigation felt responsive; AI generation took roughly 24 seconds; main JS is 565 kB minified/179.6 kB gzip |

### Top findings

1. **Critical — mobile results are not usable at narrow widths.** At approximately 473 px, result content is visibly cut off: vehicle copy, price range, item title, price, badges, and actions extend beyond the viewport. [Evidence](screenshots/09-mobile-results.png).
2. **Critical — one malformed search damages future mobile sessions.** A 300-character unbroken query was saved into Recent Searches and widened the mobile vehicle page to 3,104 px for a 463 px viewport. The user must discover and use `Clear all` to recover.
3. **High — core comparison depth is insufficient.** A popular `Brake Pads` search for a decoded 2003 Honda Accord EX-V6 returned one $215 eBay listing. One price is not a meaningful price comparison. [Evidence](screenshots/06-desktop-brake-pads-results.png).
4. **High — oversized input submits stale state.** After entering 300 characters, clearing the visible input, and pressing Enter, the prior value was submitted. The resulting error page overflowed badly. [Evidence](screenshots/03-desktop-oversized-part-error.png).
5. **High — Maintenance Kits overpromise and dead-end.** “Complete Brake Job” promises front/rear pads and rotors in one kit, but returned no listings for the test vehicle. [Evidence](screenshots/04-desktop-kit-no-results.png).
6. **High — Photo Search is not exposed accessibly.** The file input has no accessible name and the visible upload surface is not represented as a button in the accessibility tree.
7. **Medium/High — safety-critical AI guidance is too approximate.** The brake guide supplied “typical” torque values. A disclaimer is present, but exact specifications should come from authoritative service data or be omitted.

## Persona 1: Professional mechanic

Satisfaction: **5.5/10**

### Journey map

| Stage | Action | Reaction | Friction |
|---|---|---|---|
| Vehicle | Decodes VIN and confirms trim | Confident; fitment lock is useful | Engine displacement toast displayed `2.998832712L` instead of `3.0L V6` |
| Part | Searches by name/OEM, OBD code, or kit | Appreciates multiple entry modes | Category depth and technical filters are limited |
| Diagnose | Enters P0302 or symptoms | Fast route to candidate parts | Diagnostic path lacks measured test steps and authoritative references |
| Compare | Reviews price, shipping, seller, fitment | Likes dense desktop result card | One listing provides no comparison; no brand/spec/position filters |
| Decide | Opens details and repair guide | Seller and compatibility data help | AI guide uses approximate torque values; no labor time or service-manual source |

### Positive experiences

- VIN decoding and explicit trim/fitment context reduce wrong-part risk.
- OEM-number wording is present in part search.
- Seller score, feedback count, location, shipping, arrival estimate, condition, and fitment are visible together.
- OBD-II input and symptom paths are faster than browsing a deep retail catalog.
- Methodology and fitment-focused buying guides improve credibility.

### Pain points, missing features, and trust concerns

- One marketplace result would not replace a mechanic’s existing sourcing workflow.
- No brand, position, engine, drivetrain, interchange, manufacturer part number, warranty, core charge, or local-availability filters.
- “Best Value” is not meaningful when only one item exists.
- Maintenance bundles do not reliably resolve to inventory.
- No saved multi-vehicle garage optimized for fleet/customer vehicles in the tested guest flow.
- Repair guidance needs source provenance, exact specifications, and service-information boundaries.

### Recommendations

- Add professional filters and expose raw fitment evidence/interchange numbers.
- Show source coverage and listing count before calling a result a comparison.
- Add a compact “pro mode” with keyboard-first vehicle/part entry.
- Add estimate export, customer vehicle labels, labor-time ranges, and warranty/core-charge columns.
- Never output an approximate safety-critical torque value without an authoritative source.

## Persona 2: Everyday driver with limited automotive knowledge

Satisfaction: **6.5/10 desktop; 4/10 mobile**

### Journey map

| Stage | Action | Reaction | Friction |
|---|---|---|---|
| Landing | Reads value proposition and picks VIN/manual route | Reassured by plain language | VIN character stripping happens silently |
| Part | Chooses popular part or describes a problem | Symptom prompts feel approachable | Horizontal mode tabs partially hide Photo/Describe on phone |
| Diagnose | Describes brake squeal and steering shake | Strong confidence boost from explanation | Could treat diagnosis as certainty despite disclaimer |
| Compare | Looks for the “right” option | Fitment and Recommended badges help | Mobile card clipping hides decisive information |
| Purchase | Follows retailer link | Understands purchase is external | Returns, warranty, and marketplace protection are not summarized |

### Positive experiences

- “Parts that fit. Prices on radar.” is direct and understandable.
- VIN is offered as the fastest path.
- Popular part chips reduce typing.
- Symptom diagnosis explains why rotors and pads might be needed and includes a professional-inspection caveat.
- Green fitment treatment and total-price language reduce uncertainty.

### Confusing moments and abandonment risks

- `OBD-II`, `OEM number`, `fitment`, `core charge` concepts need contextual definitions.
- Invalid VIN characters disappear without explanation.
- Empty kit results contradict “pre-bundled” expectations.
- One $215 result may look like the only available option, not a coverage limitation.
- Narrow-screen clipping is a likely immediate abandonment point.
- Registration does not show password requirements before submission.

### Recommendations

- Add “What is this?” help beside VIN, OEM number, OBD-II, fitment, and seller rating.
- Show confidence as “possible cause,” followed by one safe confirmation step.
- Add plain-language part-position prompts: front/rear, driver/passenger, engine size.
- Summarize retailer return protection and warranty before outbound purchase.
- Add an explicit coverage message: “We found 1 comparable listing from 1 marketplace.”

## Persona 3: Average user

Satisfaction: **6/10 desktop; 4.5/10 mobile**

### Journey map

| Stage | Action | Reaction | Friction |
|---|---|---|---|
| Start | Selects vehicle or recent search | Modern and focused | A bad recent query can break the page width |
| Search | Taps a popular part | Fast | Five modes create a horizontally scrolling tab strip on mobile |
| Results | Scans first card | Desktop hierarchy is strong | Mobile makes quick scanning impossible |
| Save | Adds watchlist item | Immediate badge feedback | Search tab/account state is inconsistent on mobile |
| Leave | Opens retailer | Clear external handoff | Little reason to remain if only one listing exists |

### What feels modern

- Strong condensed display type, restrained blue palette, fitment badges, result ranking, responsive bottom navigation, and quick popular-part actions.

### What feels cluttered or slow

- Result cards carry many badges that become noise without multiple alternatives.
- The right-side desktop rail is useful but long.
- AI repair generation needs a progress expectation; roughly 24 seconds feels stalled.
- Duplicate `Clear filters` controls appear in the zero-results accessibility tree.

### Recommendations

- Prioritize three scan targets: total price, fitment, and arrival.
- Collapse secondary seller/offer badges behind Details on mobile.
- Display “Usually takes 20–30 seconds” for AI generation.
- Preserve the last search, but validate and truncate recent-search labels.

## Page-by-page audit

| Page / state | What works | Problem and severity | Recommended fix | Expected impact | Evidence |
|---|---|---|---|---|---|
| Landing / vehicle | Clear proposition, VIN/manual paths, disabled CTA, trust copy | **High:** normal 390 px view visibly clips wide hero/form content despite no document-level overflow reading | Remove fixed/min widths in inner wrappers; test 320/360/390/430 px; allow copy and chips to wrap | More mobile starts and completed vehicle selections | [390 px](screenshots/13-mobile-390-home.png) |
| VIN success/error | Friendly undecodable error; valid VIN populates vehicle/trim | **Medium:** invalid characters silently disappear; success toast shows unrounded displacement | Explain VIN rules inline and format engine values | Higher trust, fewer retries | [Desktop landing](screenshots/01-desktop-landing.png) |
| Part selection | Popular parts, OEM search, five discovery modes | **Medium:** mobile tabs hide later options with weak scroll affordance | Use two-row segmented controls or a “Search by” menu on narrow screens | Better feature discovery | [Mobile part screen](screenshots/10-mobile-part-selection.png) |
| Custom part search | Flexible custom terms | **High:** no max length; cleared field submits stale prior value; unbroken text destroys layout | Limit length, reset custom state on clear, trim/normalize, add `overflow-wrap:anywhere` | Prevents broken sessions and invalid API calls | [Failure](screenshots/03-desktop-oversized-part-error.png) |
| Recent searches | Useful shortcut | **Critical:** malformed query persisted and widened mobile page to 3,104 px | Cap display/storage length, sanitize before persistence, line-clamp labels, per-item delete | Restores main mobile entry path | [Mobile landing](screenshots/11-mobile-landing.png) |
| Maintenance kits | Plain repair-oriented grouping | **High:** “Complete Brake Job” returned no inventory after promising a bundle | Preflight inventory; disable unavailable kits; fall back to separate verified components | Prevents dead-end purchase intent | [Empty kit](screenshots/04-desktop-kit-no-results.png) |
| OBD-II | Specific validation and useful P0302 explanation | **Medium:** errors are not linked with `aria-invalid`/`aria-describedby`; diagnosis can imply certainty | Wire accessible errors and add one confirmation test/caveat | Better accessibility and safer decisions | — |
| Describe a Problem | Excellent plain-language flow, causes, urgency, selected parts, disclaimer | **Medium:** quote can include unverified fitment; diagnosis confidence may be overread | Default to verified items and distinguish “symptom match” from “confirmed fault” | Stronger trust and fewer wrong purchases | [Quote](screenshots/05-desktop-symptom-quote.png) |
| Photo Search | Consumer-friendly promise | **High:** file input lacks an accessible name and upload surface is absent from accessibility snapshot | Use a real labeled button/input, keyboard focus, accepted file types, privacy/upload explanation | Makes a flagship workflow usable for assistive tech | — |
| Results desktop | Excellent information density and hierarchy | **High:** only one listing for common brake pads; “Best/Cheapest” labels are tautological | Expand marketplace/API coverage; suppress comparative superlatives below 2–3 listings | Directly improves core value and conversion | [Desktop](screenshots/06-desktop-brake-pads-results.png) |
| Results mobile | Bottom nav and filters exist | **Critical:** content is cut off to the right, including prices and actions | Replace desktop grid/min-width card with single-column layout; wrap title; stack price/actions; regression-test screenshots | Essential mobile usability | [Mobile](screenshots/09-mobile-results.png) |
| Filters / zero state | Clear zero-results sentence and recovery | **Low:** duplicated Clear filters control; ZIP accepts text and lacks persistent guidance | Render one recovery action; numeric input mode/pattern; inline error | Cleaner recovery | — |
| Listing details | Seller, shipping, fitment, complementary part, watchlist, and retailer handoff are strong | **Medium:** nested modals create focus-management risk | Avoid modal-on-modal; route guide to one dialog/sheet; trap and restore focus | Better keyboard/mobile behavior | — |
| AI repair guide | Detailed tools, safety warnings, and AI disclaimer | **High:** slow with no estimate; approximate torque values in brake procedure | Add timed progress; cite service source; omit uncited exact/approximate specs | Reduces safety and liability risk | — |
| Watchlist | Immediate save, total, check prices, remove/clear, good empty state | **Low:** “bought directly from each seller” reads awkwardly before purchase | Use “Purchased on each seller’s site” or “You’ll buy…” | Copy clarity | [Watchlist](screenshots/07-mobile-watchlist.png) |
| Account / registration | Google and email paths, concise layout | **Medium:** no up-front password rules; optionality unclear; errors not tied to fields | Show rules before typing; field-level errors; loading/disabled state; recovery links | Fewer failed attempts and rate-limit events | [Registration](screenshots/08-mobile-registration-validation.png) |
| Mobile navigation | Persistent Search/Watchlist/Account is familiar | **Medium/High:** Search became active while account content remained visible | Make tab state and content atomic; add navigation regression test | Prevents orientation loss | — |
| Guides index | Eight focused, substantial buying guides; skip link; clear navigation | **Low:** no author/reviewer/date credentials visible in tested headings | Add author, reviewed date, sources, and editorial standards | E-E-A-T and trust | [Guides](screenshots/12-guides-index.png) |
| Methodology | Explains vehicle inputs, fitment, ranking, editorial process | **Medium:** public contact is a personal Gmail address | Use branded support/editorial email and company identity | Professional credibility | — |
| About / Contact | Clear purpose and correction paths | **Medium:** limited team/company identity | Add responsible publisher, location/jurisdiction, response expectation | Trust and affiliate approval readiness | — |
| Privacy / Terms / Disclosure | Present, linked, and cover accounts, retention, providers, affiliate relationship | **Low:** validate that all live processors and retention periods match implementation | Maintain processor/retention inventory and revision dates | Compliance confidence | — |
| Loading / error states | Result scanning status and friendly server error exist | **Medium:** long AI wait lacks time estimate/cancel; stale recent state survives errors | Add skeleton/progress/cancel and never persist invalid requests | Lower abandonment | — |

## Accessibility findings

### Working well

- Main production pages use one clear H1 and logical H2/H3 structure.
- Main, navigation, and footer landmarks are present.
- Editorial pages expose a `Skip to content` link.
- Header actions generally have accessible names.
- Fitment, seller rating, and condition are exposed as text rather than color alone.
- Explicit 390 px home audit found no completely unnamed standard buttons/links/inputs/selects in the initial DOM.

### Needs remediation

1. Label the Photo Search file input and represent the visible upload surface as a keyboard-operable button.
2. Add `aria-invalid`, `aria-describedby`, and persistent field-level messages to VIN, OBD, sign-in, registration, ZIP, and alert email errors.
3. Give the guest alert email a real visible/programmatic label instead of a placeholder-only name.
4. Replace clickable `div`/`li` patterns in Garage/listings with links or buttons, including Enter/Space behavior.
5. Avoid nested dialogs; implement focus trap, Escape, and focus restoration tests.
6. Ensure horizontally scrollable tab strips announce selection (`aria-selected`) and have a visible overflow affordance.
7. Add automated axe checks plus manual VoiceOver/TalkBack validation.

Keyboard sequencing could not be conclusively measured because the automation focus adapter retained focus on the VIN field. This report therefore does not claim that the full keyboard path passed.

## Performance assessment

- Normal vehicle/part transitions were perceptibly quick.
- Live brake-pad results appeared within a few seconds in repeated runs.
- AI repair generation took approximately 24 seconds, long enough to require an expectation, progress state, and cancellation.
- Production build succeeded. The main application chunk is **565.08 kB minified / 179.55 kB gzip**; the repair-guide chunk is **118.67 kB / 36.16 kB gzip**.
- Vite warned that a chunk exceeds 500 kB. Lazy-load account, advanced diagnosis, photo, charts, and repair-guide dependencies; audit icon/library imports.
- Browser navigation timing APIs were unavailable in the controlled environment, so no synthetic LCP/CLS/INP score is claimed. Add Lighthouse CI and real-user web-vitals collection.

## Improvement backlog

### Critical — fix immediately

1. Rebuild mobile results as a true single-column layout at 320–430 px.
2. Sanitize, truncate, wrap, and safely persist all user-derived search labels.
3. Prevent stale custom-part submission after clearing input.
4. Add mobile visual-regression tests for long titles, long queries, one result, zero results, and multiple badges.

### High impact

1. Increase result coverage across more marketplaces or set honest minimum-coverage expectations.
2. Preflight Maintenance Kit inventory and provide component-level fallback.
3. Make Photo Search accessible and explain image privacy/retention before upload.
4. Remove uncited approximate torque specifications from AI repair output.
5. Add field-level accessible validation and visible password rules.
6. Fix mobile tab/content state consistency.
7. Add source/review provenance to AI and editorial repair guidance.

### Medium

1. Add contextual definitions for OEM, OBD-II, fitment, core charge, and seller rating.
2. Add brand, position, engine, drivetrain, warranty, local pickup, and core-charge filters.
3. Simplify mobile badges and secondary actions.
4. Add AI progress estimate, cancel, retry, and timeout state.
5. Use a branded domain email and stronger publisher identity.
6. Add per-item recent-search removal.

### Low

1. Round decoded engine displacement and use familiar cylinder notation.
2. Remove duplicate zero-state recovery controls.
3. Improve watchlist pre-purchase wording.
4. Add dark-mode and reduced-motion visual regression coverage.

## Feature recommendations

| Feature | Why it helps | Personas | Complexity | Expected impact |
|---|---|---|---|---|
| Coverage meter | Shows marketplaces queried, matches found, verified count, and last refresh | All | Medium | High trust and conversion |
| Fitment evidence drawer | Explains which vehicle attributes/listing evidence produced verification | Mechanic, average | Medium | High trust |
| Pro search mode | Keyboard-first VIN/plate/YMME + OEM/interchange entry | Mechanic | High | High retention among professionals |
| Beginner decision assistant | Defines terms and asks front/rear/engine/position questions | Everyday driver | Medium | High completion and fewer wrong parts |
| Inventory-aware repair bundles | Assembles verified components when no true kit exists | All | High | High average order intent |
| Exact-spec source integration | Uses licensed/authoritative service information for torque and procedures | Mechanic, everyday driver | High | High safety/trust |
| Local availability and total acquisition cost | Compares delivery, pickup, tax estimate, core, and return terms | All | High | High conversion |
| Shareable repair list / quote | Exports selected parts, fitment, prices, and links | Mechanic, average | Medium | Medium/high referral and return use |
| Guided photo capture | Gives framing examples, privacy notice, confidence, and manual correction | Everyday driver | Medium | Medium/high activation |

## Competitive analysis

CarPartsRadar’s guided symptom flow is more approachable than a traditional catalog, but industry leaders make stronger guarantees and expose deeper purchasing infrastructure:

- **RockAuto** supports year/make/model/engine catalog navigation, part-number search, and explicit application verification. CarPartsRadar needs the same engine/position depth while retaining its friendlier entry experience. [RockAuto vehicle search help](https://www2.rockauto.com/help/?page=1)
- **eBay Motors** supports a saved Garage with year/make/model/trim/engine and backs eligible purchases with free returns when a part does not fit. CarPartsRadar currently labels fitment but cannot provide equivalent transactional protection; it should clearly surface which marketplace guarantee applies. [eBay Guaranteed Fit](https://pages.ebay.com/motors/ebay-guaranteed-fit/)
- **AutoZone** combines parts with store pickup/delivery, warranty protection, repair help for different skill levels, loaner tools, diagnostics, and repair-shop referral. CarPartsRadar can differentiate as an independent comparison layer, but should aggregate warranty/return/local availability and connect uncertain users to qualified help. [AutoZone services](https://www.autozone.com/lp/store-services) and [Fix Finder](https://www.autozone.com/lp/fix-finder)

Patterns to borrow:

- Persistent, named multi-vehicle garage with engine-level specificity
- Honest coverage and fitment guarantees
- Brand/position/specification filters
- Warranty, returns, core charge, pickup, and delivery shown before outbound click
- Professional source provenance for diagnostic/repair guidance
- Mobile cards designed around one-thumb scanning rather than compressed desktop grids

## Final roadmap

### Phase 1 — immediate stabilization

1. Fix mobile result/landing width behavior and add 320/360/390/430 px screenshot tests.
2. Add search length limits, stale-state reset, safe recent-search persistence, and `overflow-wrap`.
3. Correct the Search/Account mobile tab state.
4. Make Photo Search and all validation errors accessible.
5. Suppress “Best/Cheapest” claims when fewer than two choices exist.
6. Remove approximate safety-critical specifications from AI output.

Success criteria: no horizontal clipping; malformed input cannot persist; every primary control is keyboard/screen-reader operable; one-result pages state coverage honestly.

### Phase 2 — next sprint

1. Expand listing coverage and expose a source/coverage meter.
2. Make kits inventory-aware with component fallback.
3. Add beginner helper text and professional filters.
4. Add AI timeout/progress/cancel and source attribution.
5. Improve auth field validation and password guidance.
6. Implement automated axe, responsive, loading, zero-result, and navigation-state tests.

Success criteria: common searches return meaningful alternatives or a transparent coverage limitation; kits never lead directly to an unexplained dead end.

### Phase 3 — future differentiation

1. Pro garage/work-order workflow.
2. Local inventory and total-acquisition-cost comparison.
3. Authoritative service-data integration.
4. Guided photo identification with confidence and correction.
5. Shareable quote/repair list and price-history insights.

## Validation and limitations

Completed:

- Real live flows: VIN error/success, part search, popular part, OBD invalid/valid, symptom diagnosis, two-part quote, maintenance kit, result filters/zero state, details, AI guide, watchlist add/remove/empty, account/register client validation, mobile navigation, editorial/legal pages.
- Deliberate break tests: blank forms, invalid VIN/OBD, 300-character part, stale clear/Enter, rapid filter taps, retry/back navigation, refresh/state persistence.
- Responsive checks: ambient mobile breakpoint plus explicit 390 × 844.
- Automated checks: **95 tests passed**; production build passed.
- Lint: failed on existing root utility files (`fix_v4.cjs`, `fix_html.cjs`) and emitted existing warnings. No lint pass is claimed.

Not completed with real side effects:

- No real account, email alert, OAuth login, purchase, or external retailer checkout was created.
- Authenticated account deletion was not executed during this UX pass; automated deletion tests did pass.
- Offline network toggling and multi-tab race behavior were not available in the controlled browser.
- Photo upload could not be reached through an accessible interaction target; that is itself a finding.
- No production data was modified beyond temporary local watchlist/recent-search state, which was cleared after testing.

