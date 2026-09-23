# CarPartsRadar Live Validation Field Notes

Date: 2026-07-30
Target: https://carpartsradar.com/

## Desktop landing page

- Production loaded successfully with title `CarPartsRadar | Compare Car Part Prices and Fitment`.
- Strong trust copy is visible above the vehicle form: fitment-matched, live prices, and ranked value.
- Affiliate and marketplace disclosures are present in the footer.
- Vehicle flow exposes both VIN decode and year/make/model paths.
- Novice support is partly effective: VIN location appears in placeholder text, but there is no visual example or contextual help.
- Professional-mechanic friction: the consumer-oriented wizard is clear but not optimized for rapid keyboard/batch lookup.
- Baseline screenshot: `screenshots/01-home-desktop.png`.

## Desktop exact-fitment journey: 2020 Toyota Camry / Brake Pads

- Year/make/model autocomplete is fast and understandable; trim lookup loads asynchronously.
- Part-selection methods are well exposed: name/OEM, maintenance kits, OBD-II, photo, and symptom diagnosis.
- Critical production failure: results marked `Verified fitment` include titles that visibly contradict the selected vehicle.
- Result 1 is `High Perf Rear Ceramic Brake Pads Hardware Chrysler 300 2012-2020 3.6L V6 RWD`, yet it receives `Best Value`, `Cheapest Deal`, `Recommended`, and `Verified fitment`.
- Multiple Lexus-only or non-Camry titles are also labeled `Verified fitment`.
- This invalidates the primary promise, can cause a wrong-part purchase, and is especially damaging for novices who will trust the badges.
- Production screenshot: `screenshots/02-camry-brake-pads-fitment-failure.png`.
- One selected item can still open the side-by-side comparison modal; the `Compare Now` button is enabled with one item.
- The contradictory Chrysler listing detail repeats `Verified to fit 2020 TOYOTA Camry`.
- Its seller description only names Chrysler 300, Volkswagen Routan, and similar applications.
- The detail modal still offers `Generate AI Guide`, which could turn a bad fitment assertion into unsafe repair guidance.
- Detail screenshot: `screenshots/03-contradictory-listing-detail.png`.

## OBD-II workflow

- Short malformed input (`P03`) is rejected with a specific format message.
- Known code `P0302` produces a clear cylinder-2 misfire explanation and plausible component categories.
- Unsupported/unknown-looking code `P9999` is treated as a legitimate diagnostic result and recommends spark plugs, ignition coils, an oxygen sensor, and a mass-airflow sensor.
- This fallback is unsafe and misleading: it should state that the code is unknown/manufacturer-specific and avoid replacement-part recommendations without a verified definition.
- Screenshot: `screenshots/04-unknown-obd-generic-recommendations.png`.

## Authentication and VIN validation

- A synthetic invalid 17-character VIN is rejected with a clear fallback to manual vehicle selection.
- Blank sign-in shows `Email and password are required.`
- After that error, entering a malformed email leaves the old “required” message visible instead of replacing/clearing it; native email validation blocks submission, but the stale message is confusing.
- Email and password fields are keyboard reachable in the expected order.

## Editorial and policy pages

- Buying guides have strong headings, skip navigation, practical summaries, review dates, and explicit methodology links.
- Privacy policy clearly discloses Supabase, eBay, NHTSA, Gemini photo processing, PostHog website analytics, local storage, alerts, and deletion.
- Methodology states that seller titles are not turned into fitment guarantees, but the live Camry results do exactly that in effect. This contradiction materially harms trust.
- A personal Gmail address is used for correction/privacy contact; a branded domain address would look more established.
- About, Contact, Terms, and Affiliate Disclosure pages load correctly, use one clear H1, expose skip navigation, and clearly explain that CarPartsRadar is a comparison service rather than a retailer or repair facility.
- Terms correctly asks users to verify vehicle configuration and seller information, but legal disclaimers cannot compensate for a product UI that labels contradictory inventory as verified.

## Mobile 390 x 844

- No document-level horizontal overflow was detected on the landing or results pages.
- Mobile navigation, watchlist empty state, account screen, filter sheet, and loading state are coherent.
- Persistent bottom navigation works and keeps the three primary destinations available.
- Several secondary targets are below the recommended 44px touch size: vehicle-type buttons are 40px high and `Clear all` is only 16px high.
- The hero trust-badge row and result filter row use visible horizontal scrolling; the clipped content/scrollbar makes the interface look unfinished and offers weak discovery.
- Results reproduce the same critical fitment problem on mobile.
- Valid ZIP `85215` is applied to delivery estimates. Replacing it with invalid `1234` and tapping `Show results` silently preserves the old ZIP with no validation message.
- Screenshots: `screenshots/05-home-mobile-390x844.png`, `screenshots/06-results-mobile-fitment-failure.png`, `screenshots/07-account-mobile.png`.

## Maintenance-kit workflow

- Production offers a `Timing Service` bundle for a 2020 Toyota Camry without engine/applicability confirmation.
- The bundle searches `Timing Belt Water Pump Kit` and returns Honda Civic kits.
- The first Honda result is visibly labeled `Fitment not verified` yet still receives `Best Value`, `Cheapest Deal`, and `Recommended (Best Value)`.
- This combines two high-risk failures: an inapplicable maintenance suggestion and recommendation badges on unknown-fitment results.
- Screenshot: `screenshots/08-camry-timing-belt-unsafe-recommendation.png`.

## Deployment/source correlation

- Production currently shows old copy and old result behavior.
- The local working tree contains uncommitted fitment-policy, title-contradiction, repair-guide gating, timing-service suppression, result-separation, and comparison changes.
- Local branch: `ios-app` at `ece6dcc`; remote `ios-app` is the same commit. Remote `main` is `e164b763`.
- The safety fixes are not represented by the checked-out commit and are not live. This is the clearest root cause of the production-vs-local mismatch.

## Accessibility and visual checks

- Result page landmarks, document language, image alt text, and button accessible names are generally strong.
- The desktop sort select has no accessible name in the production snapshot.
- At least one checkbox control is not explicitly named in a raw form-control audit.
- Photo search exposes a file input without a direct accessible name in the accessibility snapshot; the visible wrapping label is not represented as an actionable named control.
- Dark mode has a serious selected-state contrast failure: selected `All` vehicle type text is approximately `1.68:1` (`rgb(22,56,139)` on `rgb(15,23,42)`), far below WCAG AA.
- Dark-mode placeholders and subdued helper elements are also visually faint.
- Screenshot: `screenshots/09-home-mobile-dark.png`.
- Keyboard focus moves from email to password as expected. The vehicle combobox accepted keyboard selection and advanced to Make, although automation timed out during a DOM replacement while the option list rerendered.
- Focus-visible styles are present in the local source. A full assistive-technology pass with VoiceOver/NVDA remains necessary because browser automation cannot validate spoken output.

## Resilience and state behavior

- Malformed year query shows a clear error and `Try again`, but still renders `Fitting your foo TOYOTA Camry` above the error.
- Oversized part query is rejected by the server with `part is too long`; production briefly renders the 120-character value as the page heading while loading.
- Refreshing a valid query URL restores the selected vehicle and results.
- Watchlist add/remove and empty states work; test item was removed after validation.
- Save Search correctly presents a `Log in to save searches` notification when signed out.
- Vague symptom input receives useful guidance instead of fabricated parts.
- Safety-critical brake input correctly displays `Serious safety issue — do not drive until the brake system is inspected.`
- Photo upload was not transmitted to Gemini during this audit; only the visible control, accepted file type, copy, and accessibility surface were inspected.
- A true offline/network-disconnect test was not available in the connected browser runtime. Failed upstream behavior was reviewed through malformed requests and automated server tests instead.

## Verification commands

- `npm run lint`: passed.
- `npm test`: passed, 134 tests.
- `npm run build`: passed with TypeScript and Vite production output.
- The test suite specifically covers fail-closed fitment contracts, title contradictions, signed fitment proof, unknown DTC handling, quote selection, account deletion, and API error behavior in the local working tree.
