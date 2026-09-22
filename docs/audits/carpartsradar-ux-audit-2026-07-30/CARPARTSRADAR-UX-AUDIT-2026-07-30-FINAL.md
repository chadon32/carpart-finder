# CarPartsRadar UX, UI, QA, CRO, Accessibility, and Trust Audit

**Audit date:** 2026-07-30  
**Target:** `http://127.0.0.1:5198/`  
**Auditor:** Codex (lead) with Luna/Beauvoir mobile QA pass  
**Scope:** Public website experience and locally running API-backed workflows  
**Approach:** Real browser interaction through Browser Use at desktop and mobile widths, plus project test/build/lint checks.

## Executive summary

CarPartsRadar has a clear promise, a strong vehicle-first search model, useful diagnosis guidance, responsive mobile presentation, and unusually good legal/editorial foundations for an early product. The core experience is understandable: select a vehicle, choose or describe a part, and compare live marketplace listings.

The most important finding is a release-blocking trust defect: the brake-pad results for a **2020 Toyota Camry** displayed multiple listings for Chrysler, Lexus, RAV4, Sienna, and other vehicles with the label **“Verified fitment.”** That directly contradicts the product’s central promise, **“Fitment matched, not guessed.”** It could lead a mechanic or driver to buy an incompatible safety-critical part. This must be fixed before treating the experience as production-ready.

The second major risk is account-state coverage. The local audit environment had Supabase credentials unavailable, so the site correctly disabled account operations rather than fabricating authentication. That allowed safe validation of sign-in/sign-up validation and the empty watchlist, but it did not permit verification of authenticated watchlist persistence, saved searches, price alerts, account deletion, session expiry, or post-deletion cleanup. Those paths remain release gates for any deployment that advertises accounts or feeds the iOS app.

### Scores

| Area | Score | Assessment |
|---|---:|---|
| Overall UX | **7.1/10** | Fast, coherent public journey with good recovery for invalid vehicle data; silent blank search submission and trust-breaking fitment labels lower the score. |
| UI | **8.0/10** | Distinctive visual system, good hierarchy, strong mobile layout, and consistent cards; some dense result controls and repeated actions add noise. |
| Trust | **4.5/10** | Editorial, disclosure, methodology, and seller caveats are strong, but incorrect “Verified fitment” labels are a severe credibility and safety failure. |
| Conversion | **7.0/10** | Clear vehicle-first CTA and guided symptom flow reduce uncertainty; account prompts, dense results, and questionable fitment signals can stop a purchase. |
| Accessibility | **6.5/10** | Native form semantics, visible labels, role alerts, and mobile touch targets are positive; the app landing page has no skip link, keyboard traversal could not be fully confirmed, and contrast/focus coverage needs a dedicated automated pass. |
| Performance | **7.5/10** | Local result loading was quick and browser logs were clean; production network performance was not measured, and the production build reports a 570.67 kB main JS chunk. |

### Release decision

**Not ready for a 10/10 or broad production promotion until fitment verification is fail-closed and authenticated account flows are tested in a configured staging environment.** The public UX is a strong foundation, but the result-label defect is more important than visual polish.

## Methodology and evidence

### Environments

- Main browser pass: local front end on port 5198 with the local API on port 3002.
- Desktop viewport: approximately 1280 px wide.
- Mobile checkpoint: 390 × 844 px.
- Luna mobile pass: approximately 390 × 844 px against a clean local front end on port 5190. Luna did not modify source files, create production accounts, or inspect cookies/local storage.
- No real account credentials were used. Google OAuth was not opened.
- No purchase links, outbound retailer transactions, email alerts, or destructive account operations were executed.

### Workflows exercised in the browser

- Landing page and primary navigation.
- Vehicle year, make, model, trim, vehicle-type filtering, and deep-link state.
- Part-name search, popular-part shortcuts, custom part entry, and blank submission.
- Maintenance-kit discovery.
- OBD-II malformed, unknown, and recognized-code flows.
- Photo Search empty state and file-input discovery; no image was uploaded.
- Symptom presets, custom problem guidance, safety copy, and parts-to-price selection.
- Live listing results, sorting/filter controls, fitment labels, reload, deep links, invalid vehicle recovery, and an unknown/custom part query.
- Watchlist empty state.
- Sign-in and account-creation validation.
- Theme toggle.
- Buying guides, methodology, about, contact, privacy, terms, and affiliate-disclosure pages.
- Desktop and mobile overflow checks.
- Attempts at keyboard focus traversal using the browser automation surface.
- Browser error/warning collection.

### Automated project checks

- `npm test`: **passed, 104 tests, 0 failures**.
- `npm run build`: **passed**; Vite reported a chunk-size warning for the 570.67 kB main JavaScript chunk.
- `npm run lint`: **passed**.
- Browser error/warning log at the end of the main pass: **empty**.

The automated suite covers important server/security/auth/deletion helpers, but passing tests do not prove marketplace fitment correctness or the complete authenticated UI flow. The browser findings below take precedence for the product risks they expose.

## Persona report 1 — Professional mechanic

### Journey map

| Stage | Observed behavior | Mechanic reaction |
|---|---|---|
| Entry | Landing page states the vehicle-first model and emphasizes fitment. | Positive: the value proposition is immediately legible. |
| Vehicle | Year, make, and model selection is straightforward; the model list exposes Camry and similar choices. | Positive: low click count and familiar terminology. |
| Part | Brake Pads shortcut and part-name search are prominent; OBD-II is a separate tab. | Positive: common repair paths are fast. |
| Results | Results expose seller, price, shipping, rating, details, compare, and watch controls. | Positive: useful decision fields are present. |
| Trust check | Several non-Camry titles appear with “Verified fitment.” | Severe negative: a mechanic cannot safely trust the central filter. |
| Diagnostic alternative | P0302 resolves to Cylinder 2 Misfire Detected with spark-plug, coil, and injector suggestions. | Positive: useful starting point, but should be clearly framed as a diagnostic aid rather than a parts authorization. |

### Emotional reactions

The experience starts efficient and professional. The mechanic is likely to appreciate the compact vehicle selector and result metadata, then lose trust immediately when scanning titles that do not match the selected vehicle. A mechanic will not replace a parts catalog or their established fitment/OE-number workflow if “verified” can be wrong.

### Pain points

- **Critical:** incorrect listing-to-vehicle association under “Verified fitment.”
- Results can be visually dense: pricing badges, seller data, shipping, offer labels, recommendations, and multiple actions compete for attention.
- The app does not make the strongest fitment evidence visible at the point of purchase. A mechanic needs the exact vehicle/trim/engine/position evidence, not only a badge.
- A blank part submission produces no inline feedback; pressing Enter appears to do nothing.
- The optional trim field is available but not obviously tied to how results improve when trim is provided.

### Positive experiences

- Vehicle-first workflow is faster than starting from an unqualified marketplace search.
- Common part shortcuts reduce typing.
- OBD-II results distinguish malformed codes from unknown but valid codes and provide actionable next steps.
- Listing cards surface seller rating, shipping, delivery estimate, condition, and price.
- Methodology page explains the separation between requested part, fitment evidence, and actual purchase cost.

### Confusing moments and missing features

- “Verified fitment” is ambiguous without an evidence affordance. Add an expandable explanation such as exact vehicle match, catalog source, confidence, and missing attributes.
- No obvious engine, drivetrain, brake-position, or left/right-position refinement is exposed before results for cases where those attributes determine fitment.
- No OEM-number cross-check or “confirm part number” step is visible on the result card.
- There is no fast mechanic mode that suppresses editorial explanation and exposes a compact compatibility summary.

### Trust concerns

The fitment mismatch is the dominant concern. A mechanic could interpret the label as a catalog-backed guarantee. The current disclosure that users should confirm details with retailers does not cure an incorrect in-product verification label.

### Recommendations

1. Fail closed: show **Verified fitment** only after exact vehicle compatibility passes a server-side allowlist or validated catalog match.
2. Put a high-signal compatibility summary above the title: year/make/model, trim/engine if known, brake position, and source.
3. Route mismatches to a separate **Possible match — verify before buying** section.
4. Add OEM part-number and position filters for high-risk categories such as brakes, sensors, and suspension.
5. Add a compact “Mechanic view” that keeps price, fitment, OE number, seller, delivery, and compare controls above the fold.

### Satisfaction

**6.0/10.** The workflow is promising and fast, but incorrect trust labels prevent professional use.

## Persona report 2 — Everyday driver with limited automotive knowledge

### Journey map

| Stage | Observed behavior | Driver reaction |
|---|---|---|
| Entry | “Parts that fit. Prices on radar.” and the three-step progress indicator explain the goal. | Positive and approachable. |
| Vehicle | Year → make → model sequence gives structure; VIN helper explains where to find the VIN and excluded characters. | Positive: the flow teaches without overwhelming. |
| Part uncertainty | Five search methods are discoverable: part name, maintenance kits, OBD-II, photo, and describe a problem. | Positive: the driver has alternatives if they do not know a part name. |
| Problem description | Presets populate a plain-language example; grinding-noise guidance explains worn pads and possible rotor damage. | Strong positive: safety warning and “not a professional inspection” caveat set expectations. |
| Results | Prices and seller metadata are visible, but titles and technical labels can be dense. | Mixed: useful, but uncertainty remains. |
| Purchase decision | Mismatched verified listings undermine confidence. | Abandonment risk. |

### Emotional reactions

The symptom workflow makes the driver feel helped rather than tested. The driver is likely to hesitate at trim, OBD terminology, seller quality, shipping, and “best value” scoring. The incorrect fitment badge turns normal uncertainty into distrust.

### Pain points

- Technical titles often contain long fitment ranges, engine abbreviations, and platform language without a plain-language summary.
- “Fitment not verified,” “Best Offer,” “Top Rated,” “Best Value,” and “Recommended” are not explained at the moment of decision.
- The driver may not know whether “Brake Pads” means front or rear, or whether a kit includes hardware.
- Blank part-name submission has no friendly prompt.
- The app uses a separate account flow for saved searches, but the value exchange is not always visible before the prompt.

### Positive experiences

- Clear hierarchy and mobile-safe layout.
- Describe a Problem presets lower the knowledge barrier.
- Safety-critical braking copy tells the user to arrange inspection promptly.
- Unknown OBD codes provide a safe “confirm with manufacturer or qualified technician” fallback rather than inventing a diagnosis.
- Privacy, terms, and affiliate disclosure pages are easy to find from the footer.

### Confusing moments and missing features

- Add “What does this mean?” helper text beside OBD-II, trim, fitment, seller rating, and delivery labels.
- Add a result-level plain-language line such as “Likely fits your 2020 Toyota Camry — verify front/rear position.”
- Add a “What should I buy?” guided decision mode that asks front/rear, symptoms, engine, and urgency.
- Provide a direct “Ask a mechanic” or “Confirm with a professional” handoff without implying the app is a repair authority.

### Trust concerns

Affiliate disclosure and retailer caveats are appropriate, but they are weaker than a trustworthy fitment decision. The result page needs fewer confidence labels unless they are consistently backed by evidence.

### Recommendations

1. Replace raw catalog language with a short plain-language fitment explanation, keeping technical details expandable.
2. Make front/rear and kit contents explicit for brake searches.
3. Turn a blank search into a visible, polite prompt.
4. Add visual legend/tooltips for fitment, seller rating, shipping, and “best value.”
5. Keep the safety disclaimer on symptom results adjacent to the primary CTA.

### Satisfaction

**7.5/10** for the public guided flow, reduced to **5.5/10** if the user reaches the current brake results page and notices the mismatched “verified” listings.

## Persona report 3 — Average user

### Journey map

| Stage | Observed behavior | Average-user reaction |
|---|---|---|
| Landing | Clear headline, trust chips, and vehicle selector. | Positive; understands the next action. |
| Vehicle | Custom comboboxes are visually polished and model selection is direct. | Positive, though two continuation controls appear in the mobile vehicle flow. |
| Part | Popular shortcuts are faster than typing; alternate tabs are available. | Positive. |
| Results | Many cards and controls are available immediately. | Useful but slightly crowded. |
| Save/alert | Save Search and price-drop controls are visible; unauthenticated state was not fully tested. | Potential hesitation at when and why an account is needed. |
| Recovery | Invalid deep-linked year returns a clear error and “Try again.” | Positive. |

### Emotional reactions

The average user will move quickly through the landing and vehicle selection. They may skim the result page and choose the first visually favored card. That makes the “Verified fitment” defect especially dangerous because the user may not read the long title.

### Pain points

- Result cards contain enough metadata to feel premium, but the number of badges and actions competes with the primary decision.
- The two “Continue to parts” controls observed on the mobile vehicle step can make the user wonder whether they are duplicate actions or different flows.
- Search-name and symptom-submit validation are inconsistent: symptom submit is disabled when empty, while blank part Enter is silently ignored.
- The mobile bottom navigation has an additional “Account” destination that is useful but adds a persistent control competing with search.

### Positive experiences

- Modern visual language and responsive layout.
- Clear empty watchlist state with a “Start Searching Parts” CTA.
- Theme toggle works without a visible error.
- Unknown/custom part searches still produce an honest “Fitment not verified” state when no verified match exists.

### Recommendations

1. Keep one primary action per step.
2. Collapse secondary result actions into a details sheet or overflow menu on smaller screens.
3. Make save/alert account requirements explicit before the user commits.
4. Use the same validation pattern across all search methods.
5. Lead with one recommended, verified result only after fitment evidence is confirmed.

### Satisfaction

**7.0/10** overall; the public flow is efficient, but result trust and density are barriers.

## Page-by-page and workflow audit

### 1. Landing page

**Works well**

- Strong headline and clear three-step progress model.
- Trust chips are short and scannable.
- VIN helper text is concrete and useful.
- Vehicle selection controls are prominent and progressive.
- Footer includes guides, methodology, about, contact, privacy, terms, and affiliate disclosure.
- Desktop layout had no horizontal overflow: `bodyScrollWidth` matched the visible client width.

**Issues**

- **Medium:** no skip link was found in the app landing DOM during the keyboard check.
- **Medium:** the first focus-traversal attempt stayed on the body and the automation surface could not conclusively demonstrate a complete keyboard cycle. Treat keyboard QA as incomplete, not as proof that focus is broken.
- **Low:** recent-search content can distract a new user before their first search; consider collapsing it when empty or explaining its privacy behavior.

**Recommended fix and impact**

Add a visually hidden-until-focused “Skip to main content” link, verify focus order with Playwright or Axe in CI, and keep the first CTA as the first meaningful focus target. Expected impact: medium accessibility improvement and better keyboard conversion.

### 2. Navigation and persistent controls

**Works well**

- Guides, Watchlist, Account, and theme controls are discoverable.
- Mobile bottom navigation preserves access to Search, Watchlist, and Account.
- The watchlist empty state is clear and includes a return-to-search CTA.

**Issues**

- **Low:** desktop/mobile navigation exposes overlapping ways to reach similar destinations.
- **Low:** the vehicle screen can show duplicate “Continue to parts” controls on mobile.

**Recommended fix and impact**

Keep one primary continuation control, use a single navigation source of truth for each viewport, and verify accessible names for icon-only controls. Expected impact: low-to-medium reduction in hesitation.

### 3. Vehicle lookup

**Works well**

- Year options span 1980 through 2027 in the observed local dataset.
- Make and model controls remain disabled until prerequisites are selected.
- 2020 → TOYOTA → Camry completed successfully.
- Deep-link query state loaded correctly for a valid vehicle.
- VIN field explains format and location.

**Issues**

- **Medium:** the optional trim field is not explained in terms of what it changes in the results.
- **Low:** mobile evidence showed duplicate continuation controls.

**Recommended fix and impact**

Add “Trim helps distinguish brakes, engines, and packages when listings overlap” beside the trim field. Keep the continuation action singular. Expected impact: high for fitment confidence and medium for conversion.

### 4. Part-name search

**Works well**

- Popular parts make the common path fast.
- Custom input accepts part names and OEM numbers and is capped at 60 characters.
- Pressing Enter from a populated field starts a valid search.

**Issues**

- **Medium:** pressing Enter with an empty part field produced no alert, no inline message, and no navigation. The Search button is hidden/disabled, but the user receives no explanation.
- **Medium:** input guidance says “press Enter,” but does not say what to do when the entry is not recognized.

**Recommended fix and impact**

On empty submission, show `Enter a part name or OEM number to continue.` with an accessible `role=alert` or `aria-describedby` relationship. Expected impact: medium reduction in abandonment.

### 5. Maintenance kits

**Works well**

- Five useful kit intents were visible: complete brake job, engine tune-up, timing service, front suspension rebuild, cooling system refresh, and full filter service.
- Helper text explains that component-by-component searches may be used when no combined kit exists.

**Issues**

- **Medium/unverified:** a full kit search submission and resulting fitment were not completed in this pass. It needs the same server-side fitment contract as individual parts.

**Recommended fix and impact**

For every kit, display a component checklist, vehicle attributes used, and which components are verified versus merely suggested. Expected impact: high for multi-part conversion and safety.

### 6. OBD-II error-code search

**Works well**

- Malformed `XYZ` and `P03` inputs returned clear format guidance: `Invalid OBD-II code format (must match pattern like P0302).`
- Unknown but valid `P9999` returned a safe fallback advising confirmation with the manufacturer or a qualified technician.
- Recognized `P0302` returned “Cylinder 2 Misfire Detected,” explanation, and recommended spark plug, ignition coil, and fuel injector searches.

**Issues**

- **Medium:** Luna observed that malformed OBD input `P03` still left Search enabled on mobile even though an error was visible. This creates an inconsistent affordance and can invite repeated invalid requests.

**Recommended fix and impact**

Disable Search while the code is malformed, or make the button explicitly re-run validation and retain focus on the field. Expected impact: medium clarity and lower error repetition.

### 7. Photo Search

**Works well**

- The tab clearly explains that the user can take or upload a photo.
- Empty state and helper copy describe the need for a clear, well-lit photo and note compression before sending.
- File input is present and discoverable.

**Unverified**

- No image was supplied, so recognition quality, unsupported formats, file-size errors, permission denial, retry behavior, and privacy messaging during upload were not tested.

**Recommended fix and impact**

Add explicit file-type/size limits, an upload progress state, a retry/cancel action, and a post-recognition confidence threshold. Never label a photo inference as verified fitment without catalog confirmation. Expected impact: high for trust and error recovery.

### 8. Describe a Problem / symptom guidance

**Works well**

- Plain-language textarea and useful presets are easy to understand.
- Empty “Find likely parts” is disabled.
- Grinding-noise workflow returned likely cause, strong match, safety-critical warning, part checklist, and professional-inspection disclaimer.
- “Get instant quote (2 parts)” communicates the selected scope.

**Issues**

- **Medium/unverified:** custom free-text submission, API timeout, unsafe symptom combination, and long text were not fully exercised.
- **Low:** technical parts such as “brake hardware kit” could use a short explanation for non-mechanics.

**Recommended fix and impact**

Keep the safety disclaimer adjacent to the result CTA, add a short “What this part does” expander, cap/normalize text, and test failure recovery. Expected impact: high for everyday-driver confidence.

### 9. Results — loading, success, filtering, and cards

**Works well**

- Valid brake-pad search loaded quickly in the local environment.
- Results expose live listing count, price range, condition, seller, rating, shipping, delivery, offers, details, watch, compare, and retailer CTA.
- Sorting, category, overseas, arrival, seller-rating, and ZIP controls are visible.
- Reloading a valid result deep link restored the result state.
- Unknown custom part query produced an honest single-listing state with “Fitment not verified” and an explanation that there was insufficient data for a comparison.

**Critical issue**

For selected **2020 TOYOTA Camry**, observed listings included:

- `High Perf Rear Ceramic Brake Pads Hardware Chrysler 300 2012-2020 3.6L V6 RWD`
- Lexus ES/UX listings.
- RAV4/Venza listings.
- Sienna/Highlander/Avalon/Lexus listings.

These were shown under the same result set with **“Verified fitment.”** The result page also displayed the trust promise that fitment is matched rather than guessed. This is a critical broken-access-to-trust/data correctness defect and a potential safety issue.

**Recommended fix**

- Make the server return a normalized `fitmentStatus` based on exact vehicle compatibility, not title keyword overlap.
- Apply a fail-closed UI rule: missing or conflicting compatibility data cannot render “Verified fitment.”
- Add automated fixture tests containing deliberate cross-vehicle titles.
- Separate exact matches, possible matches, and unverified results visually and semantically.
- Add an internal “why this matched” record for each verified card.
- Block or quarantine listings whose title vehicle conflicts with the selected vehicle.

**Expected impact:** critical. This is the highest priority item in the entire audit.

### 10. Results — invalid vehicle and unknown part recovery

**Works well**

- Invalid deep link `year=2099&make=NOSUCH&model=Nope` showed `We couldn't complete this search.`, explained that a valid model year is required, and offered `Try again`.
- Unknown custom part did not fabricate a verified fitment label; it showed a single listing and an honest fallback.

**Issue**

- **Medium:** the invalid-vehicle result retained a result-page heading (`BRAKE PADS`) above the error state, which can momentarily imply that the query partly succeeded.

**Recommended fix and impact**

When the query is invalid, make the error state the only primary heading and move the part name into secondary context. Expected impact: medium reduction in confusion.

### 11. Watchlist and account entry points

**Works well**

- Empty watchlist clearly says `YOUR WATCHLIST IS EMPTY` and explains the benefit of adding items.
- Sign-in and sign-up are reachable from the header and mobile navigation.
- Empty sign-in validation produced `Enter your email address.` and `Enter your password.`.
- Invalid email produced `Enter a valid email address.`.
- Sign-up includes an optional name, email, password, and an eight-character helper.

**Unverified / release gate**

- Supabase was not configured locally; account features were intentionally disabled at the server level. No real account was created.
- Authenticated saved searches, watchlist persistence, price alerts, session expiry, permission failures, stale sessions, account deletion, local-storage clearing, and re-login after deletion were not verified.
- Google OAuth was not opened.

**Recommended fix and impact**

Run a separate configured staging test with a disposable account and verify every authenticated state, especially permanent deletion and recovery after network failure. Expected impact: critical for any app release that supports account creation.

### 12. Static pages and trust signals

**Works well**

- Guides, methodology, about, contact, privacy, terms, and affiliate-disclosure routes loaded with a `main` element, a meaningful H1, local navigation, and no observed horizontal overflow.
- Methodology explains vehicle/query inputs, fitment evidence, price/ranking, and editorial process.
- About page clearly says the service does not sell, stock, or ship parts.
- Contact page provides an email and asks for enough detail to reproduce issues.
- Privacy page covers core search processing, local storage, alerts, account deletion/retention, external sites, and contact.
- Affiliate disclosure names current relationships and explains what commissions do not buy.

**Issues**

- **Medium:** policy and editorial pages contain substantial text; add a compact table of contents or section anchors on long pages.
- **Low:** the app landing page did not expose the same visible “Skip to content” text found on static pages.
- **Unverified:** actual production links, email delivery, analytics configuration, and policy consistency across deployed domains were not tested.

**Recommended fix and impact**

Keep a shared header/footer component or shared page contract, add section anchors, and run a production-link crawler before submission. Expected impact: medium trust and accessibility improvement.

### 13. Mobile responsiveness

**Works well**

- At 390 × 844, the main landing page had no horizontal overflow.
- Fixed bottom navigation remained discoverable.
- Luna found the vehicle selection sequence usable and all five part methods discoverable.
- About, privacy, and terms pages had no mobile overflow.
- Luna reported no browser console warnings/errors during the mobile pass.

**Issues**

- **Medium:** malformed OBD code can leave Search enabled after an error.
- **Low:** duplicate “Continue to parts” controls appeared in the mobile vehicle state.
- **Unverified:** real photo upload, live mobile results, API error state, rapid result taps, and keyboard/virtual-keyboard behavior were not completed on a configured live endpoint in Luna’s clean port.

### 14. Accessibility and inclusive UX

**Positive evidence**

- Native labels and placeholders are generally descriptive.
- Alerts are exposed with `role=alert` for account validation and OBD format errors.
- Controls are largely buttons, links, inputs, selects, and textareas rather than click-only generic elements.
- Mobile navigation and helper text are available.

**Gaps**

- No app landing skip link was found in the DOM during the check.
- A complete keyboard tab sequence could not be conclusively executed with the browser-control surface; focus stayed on the starting element when pressing Tab through a locator. This is an unverified risk, not a definitive keyboard defect.
- No automated axe/Lighthouse run was part of this audit.
- Contrast, reduced-motion behavior, screen-reader announcements for loading/result transitions, and focus return from modals were not fully measured.

**Recommended fix and impact**

Add axe-core or equivalent CI coverage, test with VoiceOver/NVDA, verify focus return for details/compare/repair-guide modals, honor `prefers-reduced-motion`, and provide a skip link. Expected impact: high for accessibility confidence.

### 15. Performance, loading, and failures

**Observed**

- Local valid search results arrived quickly in the audit environment.
- Reload preserved valid deep-link results.
- Browser warning/error log was empty.
- Project tests cover malformed JSON, bad origins, validation, rate limiting, upstream failures, and auth gating.

**Risks/unverified**

- Production latency, slow 3G, API timeout UI, retry behavior, request cancellation, and offline behavior were not measured.
- The production build reports a 570.67 kB main JS chunk after minification.
- Rapid multi-tap behavior was not conclusively tested against a live result endpoint.

**Recommended fix and impact**

Add loading skeletons with an explicit status announcement, timeout and retry states, request cancellation/debouncing, and a performance budget. Split the large main chunk where safe, especially repair-guide or other heavy modules. Expected impact: medium-to-high performance and conversion improvement.

## Intentionally attempted break conditions

| Condition | Result |
|---|---|
| Blank part input + Enter | No navigation or visible error; **Medium issue**. |
| Malformed OBD code | Clear validation message; Luna found Search remained enabled on mobile; **Medium issue**. |
| Unknown valid OBD code | Safe fallback, no invented explanation. |
| Invalid/deep-linked year | Clear recovery state and Try again action. |
| Unknown/custom part | Honest single-listing state with unverified fitment. |
| Rapid taps | Not fully proven against live endpoint; add automated concurrency test. |
| Refresh/back/deep link | Valid result reload restored state; invalid vehicle recovered. |
| Long part text | Client input max length observed at 60 characters; server tests also cover over-long parts. |
| Empty symptom submission | CTA disabled. |
| Multiple tabs | Not opened because the local app state was sufficient for the public audit and no cross-tab account state could be verified without credentials. |
| Network disconnect/timeout | Not safely induced in the browser; server tests cover upstream failures, but UI retry behavior remains unverified. |
| Photo upload errors | Not tested without a fixture image. |
| Expired session/already deleted account | Not tested without a disposable configured account. |

## Improvement backlog

### Critical — fix before release

1. **Fitment correctness and badge gating.** Do not label cross-vehicle or conflicting listings “Verified fitment.” Add server-side exact-match filtering, quarantine conflicts, and fixture tests.
2. **Authenticated account deletion verification.** In a configured staging environment, execute the complete account creation → sign-in → data creation → permanent deletion → sign-out/cleanup → re-login rejection journey. This is especially important because the iOS app has previously been reviewed under Apple Guideline 5.1.1(v).
3. **Production account configuration check.** Confirm production Supabase URL, anon key, service-role boundary, RLS policies, deletion RPC/Edge Function, and post-deletion cleanup are all configured and observable without exposing privileged keys.

### High impact

1. Add a compatibility evidence panel and exact-match/possible-match/unverified result groups.
2. Add API and UI tests for contradictory listing titles, missing fitment, wrong trim, and wrong position.
3. Verify authenticated save, watchlist, alert, stale-session, timeout, and permission-failure flows with disposable staging accounts.
4. Add consistent error handling to every search method, including photo upload and custom symptom requests.
5. Add axe/Lighthouse and VoiceOver/NVDA checks to the release process.
6. Add loading, timeout, retry, cancellation, and offline states.
7. Reduce or split the 570.67 kB main bundle if production performance budgets require it.
8. Make engine, drivetrain, brake position, trim, and OEM number first-class fitment inputs where needed.

### Medium

1. Show an inline error for empty part-name submission.
2. Disable malformed OBD Search or make the validation action explicit.
3. Add a skip link to the app landing page.
4. Explain result badges and seller metrics inline.
5. Make invalid deep-link errors the primary heading instead of leaving the part heading above them.
6. Add section anchors/table of contents to long guides and policy pages.
7. Add an optional compact/Mechanic results view.
8. Improve keyboard focus coverage and modal focus-return behavior.

### Low

1. Remove duplicate mobile continuation controls.
2. Simplify or collapse secondary result actions on small screens.
3. Add short helper copy for “brake hardware kit” and other technical terms.
4. Add visible “last updated” or freshness indicators to volatile prices and listings.
5. Improve empty recent-search presentation for first-time visitors.

## Feature recommendations

| Feature | Why it helps | Personas | Complexity | Expected impact |
|---|---|---|---|---|
| Fitment evidence drawer | Shows exact attributes and source behind every match. | All, especially mechanic | Medium | Very high trust and safety impact. |
| Exact-match result sections | Prevents possible matches from looking verified. | All | Medium | Critical reduction in wrong purchases. |
| Front/rear and position selector | Brake and sensor fitment often depends on position. | Mechanic, average user | Medium | High conversion and fewer returns. |
| Guided “I don’t know the part” wizard | Converts symptoms into plain-language questions. | Everyday driver | Medium | High confidence and completion impact. |
| Mechanic quick mode | Hides secondary copy and foregrounds OE number, evidence, and price. | Mechanic | Medium | High speed and repeat-use impact. |
| Save/share without unnecessary account friction | Lets users compare before committing to sign-up. | Average user | Medium | Medium conversion lift. |
| Fitment conflict monitoring | Flags title/catalog contradictions before display. | Product/operator | Medium | Critical safety and trust protection. |
| Production synthetic monitoring | Exercises search, auth, deletion, and health endpoints continuously. | Product/operator | Medium | High reliability and submission confidence. |
| Accessible results status region | Announces loading, result count, errors, and completion. | Keyboard and screen-reader users | Low | High accessibility benefit. |
| Price freshness indicator | Makes volatile marketplace data easier to interpret. | All | Low | Medium trust benefit. |

## Competitive pattern analysis

This is a pattern comparison, not a live feature-by-feature benchmark.

- **RockAuto-style pattern:** dense catalogs reward precision and clear vehicle/position taxonomy. CarPartsRadar has a friendlier entry point, but it needs stronger part-position and exact-fitment evidence to match catalog confidence.
- **Parts marketplace pattern:** retailer marketplaces expose seller, shipping, condition, and price details. CarPartsRadar already surfaces these fields; it should differentiate itself through more trustworthy fitment explanation rather than additional badges.
- **AutoZone/O’Reilly-style pattern:** consumer stores reduce anxiety with plain-language categories, vehicle garages, and clear “fits your vehicle” confirmations. CarPartsRadar’s symptom presets are a strong equivalent; make the same confidence visible on result cards.
- **Modern SaaS pattern:** progressive disclosure, one primary CTA, inline validation, keyboard support, loading skeletons, and accessible status announcements. CarPartsRadar uses progressive vehicle selection well, but results still expose many competing actions and validation behavior is inconsistent.
- **Google Shopping-style pattern:** users expect quick comparison and transparent merchant signals. CarPartsRadar should keep comparison concise while making the difference between exact compatibility and merely relevant text unmistakable.

The key competitive lesson is simple: **trustful precision beats visual abundance for an automotive purchase decision.**

## Final roadmap

### Phase 1 — Immediate / release gate

1. Correct the result data pipeline and make “Verified fitment” fail closed.
2. Add regression fixtures for the exact mismatches found in this audit.
3. Configure a staging Supabase environment and run the full authenticated account lifecycle, including permanent deletion and post-deletion access denial.
4. Verify RLS, service-role boundaries, deletion ordering, idempotency, session invalidation, local cache clearing, and error recovery.
5. Add inline blank-search validation and malformed-OBD button behavior.
6. Add a skip link and run automated accessibility checks.

### Phase 2 — Next sprint

1. Add fitment evidence, exact/possible/unverified result sections, and engine/position/OEM refinements.
2. Add loading, timeout, retry, cancellation, and offline states.
3. Test photo recognition with valid, oversized, unsupported, blurry, and permission-denied fixtures.
4. Complete account save/watchlist/alert flows with stale-session and permission-failure tests.
5. Reduce result-card density on mobile and remove duplicate continuation controls.
6. Split the largest safe bundles and establish a performance budget.

### Phase 3 — Future polish and growth

1. Ship a mechanic quick mode and an everyday-driver guided wizard.
2. Add fitment conflict monitoring and synthetic production checks.
3. Add price-freshness history, return-risk cues, and retailer-quality signals.
4. Add saved vehicle profiles, accessible comparison tables, and richer guide cross-linking.
5. Run moderated usability tests with a professional mechanic, a first-time driver, and a repeat shopper after the Phase 1 fixes.

## Apple/account-deletion note

This website audit did not claim Apple compliance because no authenticated account was available in the local environment and the iOS account-deletion flow was not executed. If the iOS app supports account creation, Apple’s 5.1.1(v) review requires an in-app path that initiates permanent deletion, not deactivation or hiding. The release evidence should include a physical-device recording showing sign-in or account creation, navigation to deletion, confirmation, completion, sign-out, and the resulting onboarding/login state. The production deletion implementation should be validated against real Supabase configuration and RLS, not only unit tests.

## Files changed by this audit

This audit intentionally did not modify product source code. It adds this report:

- `docs/audits/carpartsradar-ux-audit-2026-07-30/CARPARTSRADAR-UX-AUDIT-2026-07-30-FINAL.md` — final evidence-backed UX/UI/QA/CRO/accessibility audit.

The repository already contained unrelated modified and untracked files before/around this audit, including product code, tests, generated media, and an earlier audit snapshot. Those were preserved and not folded into this report.

## Bottom line

CarPartsRadar has a credible foundation and several genuinely strong user-centered flows, especially vehicle-first search, symptom guidance, public trust pages, and mobile presentation. It is not yet a 10/10 product because the most important promise—fitment confidence—is contradicted on the results page. Fix the data/label contract first, then verify the complete authenticated lifecycle and accessibility/performance gates in staging. After those changes, the remaining work is mostly refinement rather than reinvention.
