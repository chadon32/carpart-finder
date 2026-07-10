# iOS App Phase 5 (Web-Parity Features) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the user-identified gaps against the website: results filters & sort, symptom diagnosis + OBD-II lookup, recalls & vehicle health per garage car, and AI repair guides.

**Architecture:** Same mobile patterns. Pure filter/sort logic under Jest; new modal/stack routes for diagnose, vehicle health, and repair guide; data files (`COMMON_DTCs`, maintenance schedule) copied from the web app; markdown guides rendered with the pure-JS `react-native-markdown-display` (no native rebuild needed — ships over the dev server and in the next store build).

**Tech Stack:** existing + `react-native-markdown-display` (JS-only).

## Global Constraints

Same as Phases 1–4. Honesty guardrails carry over verbatim from the web: diagnosis shows confidence labels and never invents matches; the maintenance table shows typical intervals with no fabricated due-dates; repair guides carry the AI-generated disclaimer.

---

### Task 1: Results filters & sort (TDD on pure logic)

**Files:** Create `mobile/src/lib/listingFilters.ts` + test; modify `mobile/src/app/results.tsx`.

**Interfaces:**
```ts
export type ListingFilters = {
  sort: 'best' | 'price' | 'total' | 'rating'
  hideOverseas: boolean
  minRating: 0 | 90 | 95 | 98
  condition: 'all' | 'new' | 'used'
}
export const defaultFilters: ListingFilters
export function applyListingFilters(results: Listing[], f: ListingFilters): Listing[]
export function activeFilterCount(f: ListingFilters): number
```
Rules: `best` preserves server order; `price` ascending by `price`; `total` ascending by `price + (shippingCost ?? 0)`; `rating` descending by parsed `sellerFeedbackPercentage` (missing rating sorts last, never fabricated). `hideOverseas` drops `crossBorder`. `minRating` drops listings whose parsed rating is below it — listings with no rating are dropped only when a floor is set. `condition` matches `condition.toLowerCase().includes('new'|'used')`.

Tests cover each rule plus `activeFilterCount` (sort ≠ best counts as 1, each non-default toggle counts 1).

UI: toolbar row under the results header — "Filters (N)" button (44pt) opening a native `Modal` (`presentationStyle="pageSheet"`) with segmented rows for sort, min rating, condition, and a hide-overseas switch, plus an "Apply"/"Reset" footer; a compact sort chip row is fine. Filtered-to-empty shows "No listings match your filters — loosen them" (distinct from the genuine empty state).

Commit: "Results filters and sort with native filter sheet".

---

### Task 2: Symptom diagnosis + OBD-II lookup

**Files:** Create `mobile/src/app/diagnose.tsx`, `mobile/src/data/dtcCodes.ts` (copy `COMMON_DTCs` from web `src/components/PartSelector.tsx` verbatim, exported as `COMMON_DTCs` with its element type), `mobile/src/lib/__tests__/dtc.test.ts` for the code-shape fallback; modify `mobile/src/api/client.ts` (+`DiagnosisMatch`, `diagnoseProblem(symptom)` — copy types from web client), `mobile/src/app/part-picker.tsx` (two entry rows: "Describe the problem", "Enter an OBD-II code"), `mobile/src/app/_layout.tsx` (route, title "Diagnose").

**Interfaces:** `diagnoseProblem(symptom: string): Promise<{ matches: DiagnosisMatch[] }>`; `lookupDtc(code: string): { definition: string; parts: string[]; description: string } | null` in `dtcCodes.ts` — exact map hit, else the web's `/^P\d{4}$/` generic fallback, else null.

Screen: mode from route param (`symptom` | `obd`). Symptom mode: multiline input + Diagnose button → list of matches (title, system, confidence pill strong/likely/possible, summary, safety note when present, then part chips from `match.parts` with likely/possible tags) — tapping a part pushes `/results` with the vehicle params passed through. OBD mode: code input (autoCapitalize, monospaced) → definition + description + part chips. Invalid code → the web's message "Invalid OBD-II code format (must match pattern like P0302)."

Commit: "Symptom diagnosis and OBD-II lookup".

---

### Task 3: Recalls & vehicle health

**Files:** Create `mobile/src/app/vehicle-health.tsx`, copy `src/data/maintenanceSchedule.ts` → `mobile/src/data/maintenanceSchedule.ts` (drop any web-only imports); modify `mobile/src/api/client.ts` (+`Recall`, `fetchRecalls` from web client), `mobile/src/components/VehicleCard.tsx` (optional `onHealth` prop rendering a heart-pulse icon button), `mobile/src/app/(tabs)/garage.tsx` (wire `onHealth` → push `/vehicle-health` with car params), `mobile/src/app/_layout.tsx` (route, title "Vehicle health").

Screen: recalls section first (fetch on mount; count header; each recall: component, summary, consequence, remedy; empty → "No open recalls found for this vehicle" only after a successful fetch; fetch failure → error text with retry — never show "no recalls" on error), then the typical-maintenance table from the schedule data with the same no-due-date honesty note as the web. Part names in maintenance rows are tappable → `/results`.

Commit: "Recalls and vehicle health from the garage".

---

### Task 4: AI repair guides

**Files:** `npm i react-native-markdown-display`; create `mobile/src/app/repair-guide.tsx`; modify `mobile/src/api/client.ts` (+`fetchRepairGuide(year, make, model, part): Promise<{ guide: string }>` — POST JSON with the platform header), `mobile/src/app/results.tsx` (small "Repair guide" ghost button beside the part header), `mobile/src/app/_layout.tsx` (modal route, title "Repair guide").

Screen: generates on mount (spinner + "Writing the guide for your exact vehicle…"), renders markdown via `Markdown` with theme-aware styles, shows the disclaimer footer "AI-generated guidance — verify torque specs and procedures against your vehicle's service manual." Error → message + Try again. Guides can take ~10–20s; keep the spinner honest with the part/vehicle named.

Commit: "AI repair guide screen".

---

### Task 5: Verification

`npm test` (30+), `npx tsc --noEmit`, `npx expo export --platform ios`; append a Phase 5 on-device checklist to `mobile/VERIFICATION.md`; commit. Features are JS-only — they hot-load into the existing dev build and ride into the next store build without a new native build.
