# CarPartsRadar UX Audit Field Notes

Audit date: July 29, 2026
Target: https://carpartsradar.com/
Method: live browser interaction on desktop and mobile viewports, supplemented by source mapping and automated checks.

## Running observations

### Landing page - initial load

- The first DOM state exposes only a generic `Loading` status where the vehicle form will appear; the full form arrives shortly afterward.
- The value proposition is unusually clear for an automotive comparison tool: vehicle fitment, live prices, and value ranking are stated before the form.
- Trust copy is visible in the footer, including third-party marketplace and affiliate disclosures.
- Primary header actions are icon-driven but have accessible names (`Open buying guides`, `Open watchlist`, `Open account`, `Toggle theme`).
- The vehicle workflow supports VIN or manual year/make/model entry and correctly disables progression until required selections are made.

### Vehicle lookup and VIN validation

- Invalid VIN characters (`I`, `O`, `Q`, punctuation) are silently removed and input is truncated to 17 characters. This prevents malformed characters but gives no explanation about what changed.
- A 17-digit undecodable VIN enables submission and returns the friendly message: `Couldn't decode that VIN — try picking your vehicle manually`.
- A valid VIN correctly populated year, make, model, trim, and fitment options.
- The success toast exposed an unpolished engine value (`2.998832712L · 6-cyl`) instead of a rounded human-readable displacement such as `3.0L V6`. This weakens trust for mechanics and everyday drivers.
- The post-decode vehicle card is strong: it shows the selected vehicle, active fitment lock, trim, garage option, and a clear continuation CTA.

### Part selection and oversized input

- The part-selection screen is visually clean and keeps the selected vehicle visible. It exposes five search modes: part name, maintenance kits, OBD-II code, photo search, and symptom description.
- A 300-character part name is accepted by the client (`maxlength` is absent).
- After the 300-character value was cleared, pressing Enter still submitted the previously entered stale value. The URL retained the 300-character query.
- The server correctly rejected the query with `part is too long`, but the unbroken heading caused severe horizontal overflow: the entire results card shifted far to the right, leaving most of the viewport blank and clipping the error content and retry button.
- Severity: High. Add client-side length limits, clear the custom-option state when the input is cleared, use `overflow-wrap: anywhere` on user-derived headings, and keep the error panel within the content container.

### OBD-II and maintenance kits

- Invalid `XYZ999` input produced a specific format message (`must match pattern like P0302`), which is useful. The field did not expose `aria-invalid` or an `aria-describedby` relationship to the error, so screen-reader users may not receive the same guidance.
- A valid `P0302` returned `Cylinder 2 Misfire Detected`, a concise explanation, and shortcuts to spark plugs, ignition coils, and a fuel injector. This is a strong guided path for non-experts, although diagnostic caveats would reduce the risk of users replacing parts before confirming the cause.
- The `Complete Brake Job` tile promises front and rear pads and rotors in a single bundled kit, and the surrounding copy says users can buy all required components together. For a decoded 2003 Honda Accord EX-V6, it produced `No listings found` with only Retry or back navigation.
- Severity: High. The bundle promise and immediate empty state form a conversion dead end and weaken confidence in other presets. Evidence: `screenshots/04-desktop-kit-no-results.png`.

### Symptom diagnosis, quotes, and live results

- The plain-language symptom flow is a standout. `My brakes squeal and the steering wheel shakes when braking` produced two plausible causes, a strong-match explanation, safety urgency, preselected rotors/pads, and a visible “not a professional inspection” disclaimer.
- The two-part quote surfaced one rotor listing marked `fitment not verified` and one pad listing. The estimate clearly excluded labor and explained that prices change.
- A normal `Brake Pads` search for the same 2003 Honda Accord EX-V6 returned only one $215 eBay listing. The page labels this `Live eBay listings`, but the product-level promise is “live price comparison.” One seller and one price cannot support meaningful comparison, especially for a common vehicle/part. Severity: High for the core value proposition. Evidence: `screenshots/06-desktop-brake-pads-results.png`.
- The result card does several things well: total price, free shipping, delivery range, seller rating/count, location, fitment status, and an explanation for `Best Value`.
- The guest price-alert email field relies on its placeholder as its accessible name. The visible copy is not programmatically associated with the field. Empty submission simply focuses the field via native validation; there is no persistent, screen-reader-linked message.
- Selecting `Used` produced a clear zero-result state, but `Clear filters` appeared twice in the accessibility tree. Three rapid filter clicks did not corrupt state.
- The listing details dialog contains useful seller, fitment, shipping, complementary part, watchlist, and retailer actions. The generated repair guide took roughly 24 seconds and eventually produced detailed instructions and safety warnings.
- The AI guide gives approximate safety-critical torque values (`typically around 25 ft-lbs`, `typically 80 ft-lbs`) while also saying to verify manufacturer specifications. For brake work, this should link to authoritative service data or omit approximate values; the disclaimer alone is not a sufficient trust control.

### Watchlist and account

- Adding a result to the watchlist updated the badge immediately. The watchlist clearly displayed vehicle, part, seller, price, total, external purchase route, check-prices action, individual removal, and clear-all. The empty state is direct and actionable. Evidence: `screenshots/07-mobile-watchlist.png`.
- Guest registration and sign-in provide Google and email/password paths, labels, and basic empty-form messaging.
- Empty sign-in/create-account errors are page-level paragraphs and do not set `aria-invalid` or connect to fields with `aria-describedby`.
- Registration gives no password requirements before submission and does not mark whether `Full name` is optional. This invites avoidable rejection/rate-limit cycles. Evidence: `screenshots/08-mobile-registration-validation.png`.
- On the account view, tapping the bottom `Search` tab marked Search active but left the account content visible; `Back to Search` was still required. Severity: Medium/High mobile navigation-state inconsistency.

### Mobile and resilient-state behavior

- Normal part selection and results fit within the viewport and avoid horizontal overflow. Evidence: `screenshots/09-mobile-results.png` and `screenshots/10-mobile-part-selection.png`.
- The malformed 300-character query was persisted into `Recent searches`. On the mobile vehicle page, that unbroken recent-search button expanded the document to 3,104 px while the viewport was 463 px wide, making ordinary recent items difficult to click. Clearing all recent searches restored the page to 463 px. Severity: Critical because one bad search permanently damages the main entry screen until the user discovers `Clear all`.
- Mobile vehicle selection preserves the strong value proposition, VIN path, manual selectors, recent searches, and the three-step explanation. Evidence: `screenshots/11-mobile-landing.png`.
- Photo Search has clear consumer copy, but its actual file input has no accessible name and is absent from the accessibility snapshot. The visible `Tap to take a photo` surface is text rather than an exposed button. This blocks keyboard/screen-reader discoverability. The upload itself was not submitted because the accessible interaction target could not be reached reliably.
