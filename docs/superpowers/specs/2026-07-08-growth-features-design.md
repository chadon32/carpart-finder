# Growth Features — Design

**Date:** 2026-07-08
**Status:** Approved scope ("do all requested besides SerpApi"). Five features spanning revenue, retention, and data quality.

## Context

CarPartsRadar's live-price source is eBay (Browse API with category + compatibility filters). Amazon/AutoZone/RockAuto/etc. are outbound deep links (`src/data/retailerLinks.ts`) monetized by Amazon Associates + CJ page-script. Accounts/alerts run on Supabase (fail-closed; currently unconfigured in prod, so account routes 503). A daily Vercel Cron (`/api/cron/check-alerts`) re-prices active alerts against eBay and sends Resend emails (sender already implemented behind `RESEND_API_KEY`).

**Honesty guardrail (hard constraint):** no fabricated listings, prices, trends, or "due for service" math the app cannot actually know. Every number shown must come from a real observation or a real API, and estimates must be labeled as such.

The five features:

| ID | Feature | Category |
|----|---------|----------|
| A | eBay Partner Network affiliate tagging | Revenue |
| B | "Complete the Job" companion parts | Revenue |
| C | Real price history (observed lows + sparkline) | Retention |
| D | Garage Vehicle Health (recalls + maintenance reference) | Retention |
| E | VIN decode entry | Data/UX |

External accounts the user must create (not code): Supabase project + 3 env vars, `RESEND_API_KEY`/`RESEND_FROM`, EPN account + campaign ID. All code ships dark and lights up when keys are set.

---

## Feature A — eBay Partner Network affiliate tagging

**Goal:** monetize the primary CTA. Today `server/providers/ebay.js` sends `X-EBAY-C-ENDUSERCTX` with only `contextualLocation`; result links use `itemWebUrl`. EPN pays when the Browse API request carries `affiliateCampaignId` and the app links to the returned `itemAffiliateWebUrl`.

**Design:**
- New env var `EBAY_EPN_CAMPAIGN_ID` (added to `server/.env.example`). Absent → behavior identical to today.
- Extract a pure helper `buildEndUserCtx({ zip, campaignId })` in `server/providers/ebay.js` that joins the present parts with `,` (eBay's specified separator): `affiliateCampaignId=<id>,contextualLocation=<url-encoded country=US,zip=…>`. Returns `undefined` when neither part exists.
- `mapItem` prefers `item.itemAffiliateWebUrl || item.itemWebUrl` for `link`. `isValidItem` keeps requiring `itemWebUrl` (affiliate URL is a bonus, not a validity signal).
- `getCurrentPrices` is untouched (it never produces user-facing links).
- Footer affiliate disclosure gains an eBay Partner Network sentence (EPN requires disclosure).

**Testing:** unit tests for `buildEndUserCtx` (zip only / campaign only / both / neither) and for the link preference via an exported `mapItem` fixture test. No live eBay calls.

---

## Feature B — "Complete the Job" companion parts

**Goal:** a brake-pad job needs rotors, hardware, cleaner. Surface the rest of the job as one-tap searches → more eBay results pages and retailer deep-link opens per session.

**Design:**
- `src/data/partTypes.ts`: `PartType` gains optional `companions?: string[]` — names that MUST exactly match other `partTypes` entries (they feed `categoryForPart` and the EV powertrain filter). A curated map for the ~15 parts with natural companions (Brake Pads ↔ Brake Rotors, Spark Plugs → Ignition Coil, Water Pump → Timing Belt + Coolant + Thermostat, Alternator → Serpentine Belt + Battery, etc.). Export `companionsForPart(part: string, isElectric: boolean): string[]` that resolves names case-insensitively, filters EV-incompatible parts via `partTypesForVehicle`, and returns `[]` for unknown parts (free-text searches).
- **ResultsList aside:** new "Complete the job" card above "Compare at other stores", shown only when `companionsForPart` is non-empty: chip buttons per companion. Clicking calls a new optional prop `onSearchPart(part: string)`; App wires it to `runSearch(car, part)` (records recents, tracks, navigates — same as any search).
- **PartDetailModal:** same chips in a compact row (prop drilled from ResultsList; optional so the modal renders without it).
- Analytics: `trackEvent('Companion Part Clicked', { from, to, vehicleString })`.
- Copy stays honest: "Commonly replaced together" — a curated suggestion, no fake "frequently bought" stats.
- EV handling: companions pass through the same `powertrain: 'ice'` filter as the part grid, so a Tesla never gets spark-plug suggestions.

**Testing:** repo has no frontend test runner (deliberate); companion resolution logic lives in `partTypes.ts` as pure functions verified by `tsc` + review. Cross-reference integrity (every companion name resolves) is enforced at module load in dev via a `console.warn` — not a throw.

---

## Feature C — Real price history

**Goal:** answer "is this a good price?" with real observations, replacing the fabricated trend chart that was removed (commit 27904e6) with an honest one. Gives a return-visit reason.

**Data model** (append to `server/supabase-schema.sql`; user runs it in Supabase SQL editor):

```sql
create table if not exists public.price_history (
  id uuid primary key default uuid_generate_v4(),
  year text not null,
  make text not null,   -- normalized lowercase
  model text not null,  -- normalized lowercase
  part text not null,   -- normalized lowercase
  observed_date date not null,
  price numeric not null,          -- lowest observed total (price + shipping)
  created_at timestamptz default now()
);
alter table public.price_history enable row level security;  -- no policies: service-role only
create unique index if not exists idx_price_history_daily
  on public.price_history (year, make, model, part, observed_date);
```

One row per search signature per day, holding the **lowest observed total price** that day. Signature excludes trim (fitment filtering is Year/Make/Model; trim would fragment the series).

**Writers** — a new `server/priceHistory.js` exporting `recordPriceObservation({ year, make, model, part, total })`:
- No-ops instantly when `!accountsAvailable || !supabaseAdmin` (mock mode / unconfigured — same guard pattern as priceChecker).
- Select the day's row; insert if missing, update if the new total is lower. The select-then-write race is acceptable (worst case: a slightly higher low recorded for a day).
- Never throws to callers; logs and swallows (a history write must never break search).
- Call sites: (1) `/api/search` handler — fire-and-forget after a successful **live** (not stale, not cached) search with results, using the cheapest `price + shippingCost`; (2) `priceChecker.js` — after each alert's `findCheapest`, so alert-only signatures accrue history even without organic traffic.

**Read API** — `GET /api/price-history?year&make&model&part` in `api/index.js`:
- Validates with the existing `vehicleError` + part required; rate-limited alongside search (`searchLimiter`).
- Returns `{ observations: [{ date, price }] }` — last 90 days ascending, read via `supabaseAdmin`; the UI derives "tracking since" from the first observation. When accounts unavailable → `{ observations: [] }` (200; the UI simply doesn't render the card).

**Frontend:**
- `fetchPriceHistory` in `src/api/client.ts`.
- New `Sparkline` component (pure inline SVG, no deps): polyline of daily lows, min/max labels in `font-data`, brand-cobalt stroke, dark-mode aware.
- ResultsList aside gains a "Price radar — observed lows" card between the retailer card and PriceAlertCard, rendered **only when ≥ 5 observations exist**: sparkline + "Lowest: $X · Highest: $Y · tracking since ⟨date⟩". Copy states these are daily observed lows for this search, not a listing-level guarantee.
- No listing-level history is shown anywhere (we don't have it — honesty guardrail).

**Testing:** route tests (validation 400s; unconfigured env → empty observations) in the existing env-scenario test-file style; `recordPriceObservation` guard test (no admin client → no-op, no throw).

---

## Feature D — Garage Vehicle Health (recalls + maintenance reference)

**Goal:** turn My Garage from a re-select shortcut into a monthly-return ownership hub, with every health item one tap from a parts search.

**Recalls (real data):**
- New `server/recalls.js`: `getRecalls(make, model, year)` → NHTSA `https://api.nhtsa.gov/recalls/recallsByVehicle?make=&model=&modelYear=` via `fetchWithRetry`, mapped to `{ campaignNumber, component, summary, consequence, remedy, reportedDate }`. 24h in-memory cache + in-flight promise dedupe, exactly mirroring `nhtsa.js` patterns (same module conventions, capped cache like vehicleImages).
- Route `GET /api/recalls?year&make&model` in `api/index.js` with `vehicleError` validation; `Cache-Control: public, max-age=86400` (stable reference data, like vehicle-image). 502 on upstream failure.

**Maintenance reference (honest static data):**
- New `src/data/maintenanceSchedule.ts`: ~10 items `{ part, intervalMiles, intervalMonths?, note }` where `part` matches `partTypes` names (and respects the EV filter). Labeled everywhere as **"Typical intervals — always check your owner's manual."** No due-date math: without real service history, "due now" would be fabricated precision. Mileage is stored context, not a calculator input.

**Garage model:**
- `GarageVehicle = Car & { nickname?: string; mileage?: number; vin?: string }` in `CarSelector.tsx`. Existing localStorage entries parse unchanged (all new fields optional).
- Garage card gains a small "Health" ghost-button. Clicking opens a **VehicleHealthModal** (new component, reuses `Modal`):
  - Header: vehicle name + editable mileage field (`font-data`, saved back to the garage entry on blur).
  - **Open recalls** section: fetched on modal open (not on page load — no N-requests-per-visit), radar loader while fetching, then real NHTSA campaigns (component, summary, remedy) or an honest "No open recalls found in the NHTSA database" empty state; on fetch failure, an honest error line, never a silent empty.
  - **Typical maintenance** section: the static table (EV-filtered), each row with a "Shop" button.
  - "Shop" calls new optional CarSelector prop `onSearchPart(car: Car, part: string)`, wired in App to `runSearch` — lands directly on results for that vehicle + part.
- A compact recall-count badge appears on the garage card **only after** that vehicle's recalls were fetched this session (sessionStorage cache keyed by y|make|model) — never a fake placeholder count.

**Testing:** route tests for `/api/recalls` (param validation; upstream-failure 502 via stubbed fetch; mapping). Frontend logic is render-only.

---

## Feature E — VIN decode entry

**Goal:** the fastest, most accurate way to identify a vehicle; feeds the same `Car` object and enriches garage entries.

**Server** — `decodeVin(vin)` added in `server/nhtsa.js` (same file: it IS the vPIC API):
- `GET {BASE_URL}/DecodeVinValues/{vin}?format=json`, `fetchWithRetry`, 24h cache + promise dedupe keyed by normalized VIN.
- Route `GET /api/vin?vin=` in `api/index.js`: VIN must match `/^[A-HJ-NPR-Z0-9]{17}$/i` (17 chars, no I/O/Q) → else 400. Maps `Results[0]` → `{ year: ModelYear, make: Make, model: Model, trim: Trim || null, engine: { displacementL, cylinders, driveType, fuelType } }` (engine fields null when absent; display-only, shown in the decode toast). If `ModelYear`/`Make`/`Model` are missing/empty → 422 `{ error: "Couldn't decode that VIN" }` (honest partial-decode handling).
- vPIC returns make names in the same NHTSA namespace the make dropdown already uses, so downstream model/trim fetches behave exactly as if hand-picked.

**Frontend (CarSelector):**
- A slim "Have your VIN?" row above the Vehicle-type toggle: `font-data` uppercase input (17 max, auto-uppercase, strips spaces) + "Decode" button with loading state.
- Success: sets year/make/model (and trim when present) through the existing state setters — the normal models/trims effects re-run and the spec-plate confirms the vehicle; a sonner toast summarizes the decode. Failure: inline honest error ("Couldn't decode that VIN — pick your vehicle manually below").
- Decoded `vin` is carried onto the garage entry when the user saves the vehicle (`GarageVehicle.vin`).

**Testing:** route tests — 400 on bad VINs (length/charset), 422 on partial decode, success mapping — with stubbed upstream fetch.

---

## Cross-cutting

- **Security:** all new routes are GET, validated with the existing `vehicleError`/regex guards, and inherit the global CORS/origin gate and JSON 404/error handlers. `/api/price-history` joins `searchLimiter`; `/api/vin` and `/api/recalls` are cheap cached reads, same class as `/api/makes` (unlimited). No new secrets client-side; EPN id lives server-side only. `price_history` has RLS enabled with no policies (service-role access only), matching `guest_alerts`.
- **Fail-closed inheritance:** everything Supabase-touching guards on `accountsAvailable && supabaseAdmin` and degrades to silent no-op (writes) or empty (reads). No feature re-infers mock mode.
- **Design system:** new UI uses existing tokens/classes (`card`, `btn btn-*`, `eyebrow`, `font-data`, spec-plate, RadarMark loaders). Sparkline + health modal follow the "Blueprint & Radar" identity. Tailwind v4 rule respected: compose variants in markup.
- **Testing:** `npm test` (node:test, quoted globs) stays green; new server tests follow the env-before-import / separate-file-per-env-scenario convention. `npm run build` + `npm run lint` must pass.
- **Rollout order:** A → B → E → D → C (C last only because its value depends on Supabase being configured; its code ships regardless).

## Out of scope

SerpApi (declined), scrapers (ToS), listing-level price history, service-history logging / due-date reminders, push notifications, Supabase/Resend/EPN account creation (user checklist at delivery).
