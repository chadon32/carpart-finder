# iOS App Phase 6 (Final Web Parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining website-parity gaps: retailer deep links, companion-part suggestions, EV part filtering, ZIP-accurate shipping, price-history sparkline, and the multi-part quote builder. (Accounts/alerts stay v1.1 — blocked on the user creating the Supabase project.)

**Architecture/Stack:** Existing patterns; all JS-only. Sparkline drawn with plain flex Views (no react-native-svg — avoids a native rebuild).

## Global Constraints

Same as prior phases. Honesty: sparkline renders only with ≥5 real observations (web rule); quote rows with no listing show an explicit miss, never a fabricated price.

---

### Task 1: EV filtering + companions
- Copy `src/data/electricVehicles.ts` → `mobile/src/data/electricVehicles.ts` (standalone).
- `part-picker.tsx`: `const electric = isElectricVehicle(make, model)`; grid/search use `partTypesForVehicle(electric)`; when electric show note "Electric vehicle detected — engine-only parts are hidden."
- `results.tsx`: "COMPLETE THE JOB" chip row (from `companionsForPart(part, electric)`) below the toolbar; chips push `/results` for the companion part.

### Task 2: Retailer links
- Create `mobile/src/data/retailerLinks.ts`: `{ name, buildUrl }` entries copied from web (Amazon w/ associate tag, AutoZone, RockAuto, O'Reilly, NAPA, Advance, Walmart, Summit, Google Shopping) — no icon field (lucide is web-only).
- `results.tsx` `ListFooterComponent`: "Compare at other stores" — wrap-row of 44pt buttons opening `WebBrowser.openBrowserAsync(buildUrl(`${year} ${make} ${model} ${part}`))`.

### Task 3: ZIP-accurate shipping (TDD on client)
- Client: `searchParts(..., zip?: string)` appends `zip` param — extend the existing searchParts test.
- New `mobile/src/stores/prefs.ts` (zustand persist, `cpr-prefs`): `{ zip: string; setZip(z: string): void }` (5-digit filter).
- Filter sheet gains a "Shipping ZIP" numeric input; results `run()` passes `zip || undefined`; changing ZIP re-runs the search.

### Task 4: Price-history sparkline (TDD on scaling)
- Client: `fetchPriceHistory(year, make, model, part): Promise<{ observations: { date: string; price: number }[] }>` (copy shape from web).
- `mobile/src/lib/sparkline.ts`: `sparklineHeights(prices: number[]): number[]` — normalize to 0..1 (flat series → all 0.5). Test: rising, flat, empty.
- Results footer (above retailer links): when ≥5 observations, "PRICE HISTORY (last N days)" + a 40pt-tall row of flex bars (heights from helper), min/max labels. Absent otherwise — never a fake chart.

### Task 5: Multi-part quote in diagnosis
- Client: `QuoteItem/QuoteResponse` types + `fetchQuote(year, make, model, parts[], trim?, zip?)` copied from web shapes.
- `diagnose.tsx` (symptom mode): part chips become toggleable (checkmark); ≥1 selected shows "Get combined quote (N)" → quote card: per-part row (part → cheapest listing title+price, or "no listing found"), subtotal, shipping, total; Buy buttons open listings; error state + retry.

### Task 6: Verification
- `npm test` (40+), `npx tsc --noEmit`, `npx expo export --platform ios`; Phase 6 checklist in VERIFICATION.md; commit; sync main.
