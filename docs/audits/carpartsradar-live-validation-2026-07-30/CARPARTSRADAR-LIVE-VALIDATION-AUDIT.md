# CarPartsRadar Live UX, QA, CRO, and Accessibility Audit

**Audit date:** July 30, 2026  
**Production target:** https://carpartsradar.com/  
**Tested viewports:** Desktop 1280 x 720; mobile 390 x 844  
**Repository reviewed for correlation:** `C:\Users\chado\Documents\car part finder`  
**Primary test vehicle:** 2020 Toyota Camry  

## Executive Summary

CarPartsRadar looks considerably more mature than the average early-stage automotive comparison product. It has a polished visual system, clear vehicle-selection paths, multiple ways to identify a part, useful loading and empty states, transparent affiliate copy, and unusually thorough editorial and privacy pages.

The live product nevertheless has a release-blocking trust defect: it labels visibly incompatible marketplace listings as **Verified fitment** and **Recommended**. A Chrysler 300 brake-pad listing was presented as verified for a 2020 Toyota Camry, and a Honda Civic timing-belt kit received recommendation badges after the Camry maintenance workflow initiated an inapplicable timing-service search. An unknown `P9999` diagnostic code also produced confident component recommendations.

These are not cosmetic issues. They can lead a novice to buy the wrong part and make a professional mechanic stop trusting every other result. Legal disclaimers do not neutralize explicit “Verified” and “Recommended” assertions in the purchase flow.

The local working tree already contains fail-closed fitment rules, title-contradiction checks, signed fitment proof, repair-guide gating, safer DTC handling, and timing-service suppression. All 134 local tests pass. Production is serving older behavior because those changes are uncommitted and not deployed from the checked-out commit.

### Scores

| Dimension | Score | Rationale |
|---|---:|---|
| Overall UX | **6.1 / 10** | Fast, polished flow undermined by unsafe result confidence |
| UI quality | **8.2 / 10** | Strong layout, typography, component polish, and responsive structure |
| Trust | **2.5 / 10** | Core fitment promise is contradicted by live recommendations |
| Conversion | **5.8 / 10** | Clear funnel, but knowledgeable users will abandon after seeing contradictions |
| Accessibility | **6.8 / 10** | Good landmarks and general semantics; contrast, labels, and touch sizes need work |
| Performance | **8.0 / 10** | Fast perceived loads and useful loading states; real Web Vitals were not available |

## Method and Limitations

The site was operated in live browsers rather than assessed only from source. Testing covered:

- Landing and navigation
- VIN and year/make/model selection
- Part-name, maintenance, OBD-II, photo, and symptom workflows
- Results, filters, ZIP, sorting, listing detail, compare, watchlist, and save-search behavior
- Authentication and account screens
- Loading, empty, invalid, oversized, refresh, and back-state behavior
- Mobile responsiveness, dark mode, keyboard traversal, accessible names, and touch targets
- Guides, methodology, privacy, about, contact, terms, and affiliate disclosure

Safety constraints:

- No real purchase was made.
- No real account was created.
- No image was sent to Gemini.
- No real alert, email, or external repair quote was requested.
- A true offline network simulation and a full VoiceOver/NVDA session were not available.
- No dedicated “report” page exists in the current web product; results, listing details, and repair guidance are the equivalent output surfaces.

## Critical Evidence

### 1. Incompatible listing marked verified and recommended

![A Chrysler brake-pad listing marked verified for a Toyota Camry](screenshots/02-camry-brake-pads-fitment-failure.png)

For a 2020 Toyota Camry brake-pad search, the first result was:

> High Perf Rear Ceramic Brake Pads Hardware Chrysler 300 2012-2020 3.6L V6 RWD

The card simultaneously displayed:

- Best Value
- Cheapest Deal
- Recommended (Best Value)
- Verified fitment

The detail view then asserted “Verified to fit 2020 TOYOTA Camry” even though the seller description listed Chrysler 300, Volkswagen Routan, and other non-Camry applications.

![Contradictory seller details still marked verified](screenshots/03-contradictory-listing-detail.png)

### 2. Inapplicable Camry maintenance recommendation

The maintenance workflow offered “Timing Service” for the Camry and searched for a timing-belt/water-pump kit without confirming engine applicability. It returned Honda Civic inventory. The first item correctly said “Fitment not verified” but still received “Recommended,” “Best Value,” and “Cheapest Deal.”

![Honda timing kit recommended in a Camry flow](screenshots/08-camry-timing-belt-unsafe-recommendation.png)

### 3. Unknown diagnostic code creates generic parts advice

`P03` was correctly rejected as malformed and `P0302` was handled plausibly. `P9999`, however, was treated as a real fault and generated spark plug, ignition coil, oxygen sensor, and MAF recommendations. Unknown or manufacturer-specific codes must not produce generic replacement advice without a verified definition.

![Unknown OBD code producing generic recommendations](screenshots/04-unknown-obd-generic-recommendations.png)

## Persona 1: Professional Mechanic

### Journey map

1. Opens desktop site at a shop workstation.
2. Selects 2020 Toyota Camry using year/make/model.
3. Chooses Brake Pads.
4. Scans result badges and seller titles.
5. Opens the top result and compares seller fitment details.
6. Tests maintenance and OBD workflows.
7. Tries mobile use for an in-bay lookup.

### Emotional reactions

| Stage | Reaction |
|---|---|
| Landing | “Modern and faster-looking than a traditional catalog.” |
| Vehicle selection | “Clear, but a compact engine/trim-first workflow would be faster.” |
| Results | “The title contradicts the fitment badge. I cannot trust this catalog.” |
| Detail | “The same false assertion is repeated and can feed an AI guide.” |
| Maintenance | “A timing-belt service recommendation without engine applicability is unacceptable.” |
| Editorial pages | “Methodology is thoughtful, but production does not enforce it.” |

### What works

- Responsive vehicle and part selection
- Part/OEM number search
- Multiple diagnostic entry points
- Price, shipping, condition, and seller information visible together
- Refresh restores a valid search
- Clear marketplace and affiliate disclosures

### Pain points

- Core fitment badges are not credible in production.
- Trim and engine are not treated as an obvious fitment gate.
- Consumer wizard requires more interaction than a mechanic-oriented catalog.
- One item can open a “comparison” view.
- Maintenance bundles can imply service requirements without configuration proof.
- No compact list/table mode for fast scanning.

### Missing capabilities

- Engine/trim-specific fitment evidence
- Manufacturer/OE interchange evidence beside each result
- Compact keyboard-first catalog mode
- Position/side/axle fitment attributes for parts such as brakes
- Fast exclusion of contradictory titles
- Clear source and timestamp for every compatibility assertion

### Trust concerns

The mismatch between title and badge is immediately visible to a mechanic. Once one obvious error is found, price ranking, maintenance guidance, AI guides, and all other compatibility labels become suspect.

### Recommendations

1. Fail closed: no “Verified” or automatic “Recommended” label without provider compatibility evidence plus contradiction checks.
2. Require engine/trim when the category depends on those attributes.
3. Show fitment evidence, not merely a badge.
4. Add a dense mechanic mode with keyboard shortcuts and category/position columns.
5. Disable AI repair guides until a server-issued fitment proof validates the exact vehicle, part, and listing.

**Satisfaction score: 4.5 / 10**

## Persona 2: Everyday Driver

### Journey map

1. Arrives from search with limited part vocabulary.
2. Uses VIN help or year/make/model.
3. Explores symptoms, OBD-II, or photo search.
4. Accepts the top “Recommended” and “Verified fitment” card.
5. Opens listing details and considers leaving for the retailer.
6. Saves an item or attempts an alert.

### Emotional reactions

| Stage | Reaction |
|---|---|
| Landing | “This looks legitimate and promises to check fitment for me.” |
| Vehicle selection | “The step-by-step flow is reassuring.” |
| Method choice | “I can describe a symptom even if I do not know the part.” |
| Results | “The app says verified, so I assume it is safe to buy.” |
| Contradiction | A novice may not recognize “Chrysler 300” as a contradiction and can purchase the wrong item. |
| Unknown OBD | “The app gave me parts, so one of these must fix it.” |

### What works

- Plain-language entry paths
- Useful symptom guidance for vague input
- Correct high-severity warning for a brake pedal going to the floor
- Helpful malformed VIN and malformed OBD messages
- Clear loading, empty, and signed-out save-search states
- Strong privacy and marketplace disclosures

### Confusing moments

- “Verified fitment” is more confident than the evidence.
- Best Value and Recommended can appear on unverified inventory.
- `P9999` appears authoritative although the code is not recognized.
- ZIP validation silently preserves an older ZIP.
- Stale auth error copy remains after the input changes.
- Photo search does not explain, immediately beside the control, that an external AI provider processes the image.

### Terms needing help

- OEM number
- OBD-II / DTC
- Fitment evidence
- Core charge
- Remanufactured
- Front/rear or left/right position requirements
- Trim and engine displacement

### Likely abandonment triggers

- A knowledgeable friend notices an incompatible title.
- No clear reason is shown for a compatibility decision.
- A generic error occurs after a photo or external API request.
- The user must choose a technical part from a vague diagnostic suggestion.

### Recommendations

1. Replace unsupported “Verified” claims with “Compatibility not confirmed.”
2. Explain why each listing matched in a short evidence drawer.
3. For unknown DTCs, stop and request manufacturer-specific documentation or professional diagnosis.
4. Add short definitions or tooltips only where technical terms first appear.
5. Put photo-processing disclosure beside the upload control.
6. Use explicit inline validation for ZIP and authentication.

**Satisfaction score: 4.0 / 10**

## Persona 3: Average User

### Journey map

1. Opens on mobile.
2. Selects vehicle and part quickly.
3. Skims top badges rather than descriptions.
4. Uses filters and ZIP.
5. Opens a result, adds to watchlist, or tries comparison.
6. Returns through bottom navigation.

### Emotional reactions

| Stage | Reaction |
|---|---|
| Landing | “Clean and modern.” |
| Search | “Fast and easy to understand.” |
| Results | “There are many badges competing for attention.” |
| Filters | “The horizontal rows look clipped.” |
| Detail | “Useful information, but I trust the colored labels more than the fine print.” |
| Watchlist/account | “Simple and predictable.” |

### What works

- Strong visual hierarchy
- Persistent mobile bottom navigation
- Fast perceived feedback
- Clear watchlist empty state
- Save-search sign-in prompt is actionable
- No document-level mobile horizontal overflow

### Friction and clutter

- Too many simultaneous badges on result cards
- Horizontal trust/filter rows visibly scroll and expose scrollbars
- One-column comparison is allowed
- “Clear all” and vehicle-type targets are too small
- Invalid ZIP produces no error
- Malformed route values briefly appear in headings

### Recommendations

1. Establish one badge hierarchy: fitment first, then price/value.
2. Enable comparison only with two or more items.
3. Wrap or redesign mobile chip/filter rows instead of showing scrollbars.
4. Validate ZIP inline and never silently reuse an old value.
5. Sanitize route parameters before rendering them into headings.

**Satisfaction score: 5.5 / 10**

## Page-by-Page Audit

| Surface | What works | Problem | Severity | Recommended fix | Expected impact |
|---|---|---|---|---|---|
| Landing | Premium look, clear promise, trust and affiliate copy | Consumer wizard is slower for repeat professionals | Medium | Add compact/recent-vehicle entry without removing guided flow | Faster repeat searches |
| Vehicle selector | Responsive autocomplete; VIN fallback | Selected dark-mode chip contrast is about 1.68:1 | High | Use AA-compliant selected foreground/background tokens | Readable selection state |
| VIN | Invalid synthetic VIN fails clearly | VIN help is mostly text-only | Low | Add a small VIN-location illustration and privacy hint | Better novice completion |
| Part/OEM search | Supports known parts and OEM terms | No strong distinction between exact part number and broad keyword | Medium | Label search intent and show confidence/source | Fewer broad matches |
| Maintenance | Useful bundle concept | Camry timing-belt bundle is offered without applicability proof | Critical | Gate maintenance bundles by engine and verified schedule data | Prevent unsafe searches |
| OBD-II | Good format validation and known-code explanation | Unknown `P9999` generates generic replacement advice | Critical | Treat unknown/manufacturer-specific codes as unresolved; no parts recommendations | Prevent misdiagnosis |
| Symptom diagnosis | Vague input gets guidance; brake danger warning works | AI-derived parts still need explicit uncertainty and escalation | Medium | Show reasoning/source and require confirmation before search | Safer novice use |
| Photo search | Accepts images and describes purpose | File input lacks a dependable accessible name; no nearby Gemini disclosure | High | Add explicit label/description and processing disclosure | Accessibility and privacy trust |
| Results | Useful price/shipping/seller scan; loading state works | Contradictory listings marked verified and recommended | Critical | Deploy fail-closed fitment policy and title/details contradiction checks | Restores core product integrity |
| Result controls | Filters, sorting, and ZIP available | Sort lacks accessible name; invalid ZIP silently preserves old ZIP | High | Label sort; inline ZIP error; do not apply stale value | Better accessibility and predictability |
| Listing detail | Rich seller and shipping detail | Repeats false verification; AI guide available for contradictory listing | Critical | Require signed exact fitment proof before verification or guide | Prevent unsafe downstream guidance |
| Comparison | Modal presentation is clean | Opens with only one selected item | Medium | Disable until two items are selected and announce requirement | Avoid empty feature impression |
| Watchlist | Add/remove and empty state work | No material defect found in guest flow | Low | Preserve behavior; test account sync | Retention confidence |
| Save Search | Signed-out prompt is clear | Account dependency can interrupt an otherwise guest-first flow | Low | Keep guest search; explain benefits before auth | Lower friction |
| Authentication | Keyboard order and required-field feedback | Old required error persists after malformed email entry | Medium | Clear stale server error on input and add field-specific messages | Less confusion |
| Account | Mobile layout is coherent | Full real account and deletion were not executed in production | Medium | Add E2E test account and deletion verification | Release confidence |
| Guides | Strong headings, sourcing, review dates, skip link | Content promise conflicts with production fitment behavior | High | Treat methodology claims as executable acceptance tests | Stronger trust |
| Methodology | Transparent and appropriately cautious | Says titles do not become guarantees while live UI does that in effect | Critical | Block release when production violates the policy contract | Avoid misleading claims |
| Privacy | Detailed provider/data disclosure and deletion guidance | Personal Gmail weakens publisher credibility | Low | Use a branded support/privacy address | Professional trust |
| Contact/About/Terms | Clear publisher role and corrections process | Legal caution cannot repair confident UI misinformation | Medium | Align product states with policy language | Reduced legal/trust risk |
| Mobile | No page-wide overflow; bottom nav works | Chip/filter rows look clipped; some targets under 44px | Medium | Wrap rows; increase hit areas; hide decorative scrollbars | Better touch usability |
| Error states | Clear Try Again on malformed route | Raw invalid year/oversized part renders in heading before validation | Medium | Validate before display and use neutral loading heading | More polished failure handling |
| Loading/refresh | Helpful loading copy; valid URL restores state | No retry affordance attached to every upstream failure | Medium | Add consistent error boundary and retry action | Better resilience |

## Accessibility Findings

### Strengths

- `lang="en"` is present.
- Main landmarks and page headings are generally meaningful.
- Static pages include a skip link.
- Product images have useful alternative text.
- Most buttons expose understandable accessible names.
- Email-to-password keyboard order works.
- Mobile pages do not create document-level horizontal overflow.

### Gaps

1. **Dark-mode selected state:** approximately 1.68:1 contrast, below WCAG AA.
2. **Unlabeled sort:** desktop results sort select lacks an accessible name.
3. **Unlabeled form controls:** at least one checkbox and the photo input do not expose dependable names in the accessibility snapshot.
4. **Touch targets:** mobile vehicle-type controls are about 40px high and “Clear all” is about 16px high.
5. **Error announcement:** vehicle lookup and similar async failures need a live region and a focused retry action.
6. **Selection state:** toggle-style buttons should expose `aria-pressed`.
7. **Heading hierarchy:** results move from H1 to H3 cards without a clear H2 grouping.

### Required follow-up

Run VoiceOver on iOS and NVDA on Windows against the deployed fixed build. Browser automation can inspect semantics but cannot validate spoken order, rotor grouping, or screen-reader announcements.

## Conversion and Copy Audit

### Strong conversion elements

- Clear primary promise
- Multiple search entry methods
- Live-price and shipping visibility
- Marketplace transparency
- Save/search/watchlist retention hooks
- Mobile bottom navigation

### Conversion risks

- “Verified fitment” is the most persuasive label and currently the least trustworthy.
- Four overlapping badges on one card dilute hierarchy.
- Recommendation language is applied before compatibility is resolved.
- Users can be sent from a maintenance or diagnostic flow directly into unrelated inventory.
- External retailer transfer happens before CarPartsRadar provides enough fitment evidence.

### Copy principle

Compatibility status must be phrased as a hierarchy of evidence:

1. **Verified for this exact configuration** — only with exact provider evidence and no contradiction.
2. **Possible match — verify engine/trim/position** — candidate inventory.
3. **Not verified** — never eligible for automatic recommendation.
4. **Contradiction found** — excluded from primary results.

## Improvement Backlog

### Critical

1. Deploy the local fail-closed fitment contract to production.
2. Exclude title/details contradictions from verified and recommended results.
3. Require server-issued exact fitment proof before generating a repair guide.
4. Remove or gate timing-belt maintenance bundles until engine-specific applicability is known.
5. Replace unknown DTC fallback advice with an unresolved/manufacturer-specific state.
6. Add production smoke tests that fail if Chrysler/Honda inventory is marked verified for the Camry fixture.

### High Impact

1. Separate verified results from compatibility-unknown marketplace candidates.
2. Require at least two items before comparison.
3. Fix dark-mode selected-state contrast.
4. Add accessible names to sort, checkbox, and photo controls.
5. Add explicit ZIP and field-level auth validation.
6. Show fitment evidence and source timestamps in listing detail.
7. Display a photo-processing disclosure beside upload.

### Medium

1. Add engine/trim/position prompts only when category-specific.
2. Wrap mobile chips and filters; remove visible horizontal scrollbars.
3. Increase all mobile targets to at least 44 x 44 CSS pixels.
4. Sanitize URL values before rendering headings.
5. Add consistent error live regions and retries.
6. Clear stale auth errors when inputs change.
7. Add a dense mechanic-oriented result view.

### Low

1. Replace the personal Gmail with branded support and privacy addresses.
2. Add a VIN-location illustration.
3. Clarify exact part-number versus broad keyword search.
4. Normalize result-card badge count and visual weight.

## Feature Recommendations

| Feature | Why it helps | Personas | Complexity | Expected impact |
|---|---|---|---|---|
| Fitment evidence drawer | Explains exactly why a listing matches | All | Medium | Very high trust gain |
| Exact vehicle garage | Persists VIN/engine/trim and prevents repeated entry | Mechanic, average | Medium | High speed and retention |
| Mechanic compact mode | Dense table, keyboard navigation, interchange data | Mechanic | Medium | High professional adoption |
| Unknown-DTC escalation | Stops generic part replacement and points to verified resources | Novice, average | Low | High safety gain |
| Position-aware part prompts | Captures front/rear, left/right, axle, engine details | All | Medium | High fitment accuracy |
| Compatibility proof history | Records source, time, and exact vehicle configuration | Mechanic | High | High trust and support value |
| Automated production canaries | Runs known good/bad fixtures after deploy | Product/QA | Medium | Very high reliability |

## Competitive Analysis

### eBay Motors

eBay’s official fitment guidance asks buyers for full year, make, model, trim, and engine and bases compatibility on seller-provided compatibility data. Eligible exact-fit items can receive a clear fitment indicator and purchase protection. CarPartsRadar currently asks for less configuration and then uses stronger language than its evidence supports.

Relevant references:

- https://www.ebay.com/help/buying/getting-started-ebay/buying-vehicles-parts-accessories?id=4639
- https://www.ebay.com/sellercenter/protections/ebay-guaranteed-fit
- https://pages.ebay.com/motors/ebay-guaranteed-fit/

**Pattern to adopt:** exact configuration first, explicit compatibility evidence second, protection/limitations third.

### RockAuto

RockAuto’s official help directs shoppers through year, make, model, and engine. If the correctly configured catalog does not list the part, RockAuto says it does not have it rather than filling the gap with loosely related marketplace inventory.

Reference:

- https://www.rockauto.com/help/?page=1

**Pattern to adopt:** a strict catalog boundary and a dense, fast hierarchy for knowledgeable users.

### AutoZone and major consumer retailers

Large retailers use a persistent vehicle garage and catalog data keyed to year, make, model, and engine, often combining fitment with local inventory. Their interfaces reduce uncertainty by keeping the selected vehicle visible and making compatibility a gating state rather than a decorative badge.

Reference:

- https://about.autozone.com/static-files/bb09b680-0401-425d-9444-a903ac4b91c7

**Pattern to adopt:** persistent exact vehicle, visible local availability, and fitment as a prerequisite for recommendation.

### Competitive position

CarPartsRadar’s strongest differentiator is its combination of live marketplace comparison, diagnosis entry points, editorial transparency, and a modern UI. Its largest gap is not feature breadth; it is evidence discipline. The product can be more useful than traditional catalogs only if it is at least as conservative about fitment.

## Final Roadmap

### Phase 1 — Immediate release safety

1. Freeze automatic “Verified fitment” and “Recommended” labels on production until the fail-closed build is deployed.
2. Commit and review the current local fitment-policy changes.
3. Deploy to a preview environment.
4. Run the Camry brake-pad, Camry timing-service, unknown-DTC, and contradictory-detail canaries.
5. Confirm repair-guide endpoints reject missing or mismatched fitment proof.
6. Deploy production and rerun the same checks from the public URL.
7. Monitor incompatible-result rate and provider contract errors.

### Phase 2 — Next sprint

1. Add engine/trim/position-aware search gates.
2. Add visible fitment-evidence drawers.
3. Fix contrast, accessible names, touch targets, comparison minimum, ZIP validation, and stale errors.
4. Add Playwright E2E tests for desktop and mobile critical journeys.
5. Add live-region announcements and retry actions for async failures.
6. Simplify result-card badge hierarchy.

### Phase 3 — Future differentiation

1. Build a mechanic compact mode and keyboard command palette.
2. Add a persistent exact-vehicle garage.
3. Add compatibility evidence history and interchange data.
4. Add production Web Vitals collection and performance budgets.
5. Run formal VoiceOver/NVDA usability studies.
6. Recruit mechanics and novice drivers for task-based validation after fitment safety is proven.

## Verification Results

| Check | Result |
|---|---|
| `npm run lint` | Passed |
| `npm test` | Passed — 134 tests |
| `npm run build` | Passed — TypeScript and Vite production build |
| Desktop live journey | Completed |
| Mobile 390 x 844 journey | Completed |
| Dark-mode visual check | Completed |
| Watchlist add/remove | Completed and cleaned up |
| Real purchase | Not performed |
| Real account creation/deletion | Not performed |
| Photo sent to Gemini | Not performed |
| VoiceOver/NVDA | Requires manual follow-up |
| True offline simulation | Requires dedicated E2E environment |

## Release Decision

**Do not promote the current production fitment behavior as verified or recommendation-safe.**

The local test-covered remediation is promising, but release readiness depends on deploying it and repeating the live evidence tests. The minimum release gate is:

- no contradictory title/detail can receive a verified badge;
- compatibility-unknown inventory cannot receive an automatic recommendation;
- unknown DTCs do not generate part replacement advice;
- repair guides require exact signed fitment evidence;
- production canary tests pass after deployment.

