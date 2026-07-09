# Mobile Experience Overhaul — Design

**Date:** 2026-07-09
**Status:** Approved (user pre-approved all sections and authorized autonomous execution)
**Goal:** Elevate CarPartsRadar from "responsive website" to a premium, app-like mobile experience — installable, thumb-driven, touch-correct — without changing the desktop experience, the architecture (state-machine steps in `App.tsx`, no router), or any existing functionality.

## Approved decisions

1. **Full PWA** — installable via manifest + icons, `display: standalone`. **No service worker** (deliberate: prices are live; the honesty guardrail forbids anything that could present stale data as fresh, and a shell-caching SW risks stale-bundle bugs for near-zero gain behind Vercel's CDN).
2. **Bottom tab bar** on `<640px`: Search / Watchlist (badge) / Account. Desktop header unchanged.
3. **Bottom sheets** for all modals on `<640px` via **vaul** (~5 kB, Radix-based, React 19 compatible); centered dialogs stay on desktop.
4. **Approach:** mobile primitives + surface-by-surface redesign. No router, no animation framework, vaul is the only new dependency.

## Audit findings being fixed

| # | Problem | Where |
|---|---------|-------|
| 1 | Touch targets far below 44px (pills `py-1`, tabs `pb-2.5`, icon buttons `p-1`, text links) | ListingCard, ResultsList toolbar, PartSelector tabs, CarSelector garage, CartPanel, Dashboard |
| 2 | iOS zoom-on-focus: all inputs are 14px (`text-sm`); iOS force-zooms under 16px | `.field` in index.css, Combobox, ZIP, VIN, auth, symptom textarea |
| 3 | 5 `flex-1` tabs can't fit at 375px | PartSelector |
| 4 | Filter toolbar wraps into ~4 uneven rows before content | ResultsList |
| 5 | Hover-only tooltip (Best Value explanation) unreachable on touch | ListingCard |
| 6 | Compare floating bar at `bottom-6` will collide with new tab bar | ResultsList |
| 7 | Hero pushes vehicle selector below the fold on iPhone SE | App.tsx |
| 8 | No `viewport-fit=cover`, no safe-area handling, no manifest | index.html, index.css |
| 9 | Combobox: 36px rows, 288px list fights the on-screen keyboard | Combobox |
| 10 | Centered `max-h-[90vh]` dialogs cramped on phones | Modal + 5 consumers |
| 11 | 4-button action row wraps messily on listing cards | ListingCard |
| 12 | Watchlist rows overflow/truncate hard at 375px; totals row crowds | CartPanel |

## Section 1 — Mobile foundation & PWA

**index.html**
- Viewport meta gains `viewport-fit=cover`.
- Add `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" ...>`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="apple-mobile-web-app-title" content="PartsRadar">`.
- Add `<link rel="preconnect" href="https://i.ebayimg.com">` (perf, Section 5).

**public/manifest.webmanifest**
- `name` "CarPartsRadar", `short_name` "PartsRadar", `display: "standalone"`, `start_url: "/"`, `theme_color: "#2050c8"`, `background_color: "#fafafa"`.
- Icons: 192px + 512px PNG, plus a 512px `purpose: "maskable"` variant, all generated from the RadarMark on the brand cobalt gradient, stored in `public/icons/`. A 180px `apple-touch-icon.png` (iOS ignores the manifest for this).

**index.css foundation**
- Utilities: `.pb-safe { padding-bottom: env(safe-area-inset-bottom) }` and use of `env(safe-area-inset-*)` in the tab bar / compare bar / sheets via arbitrary values.
- `body { overscroll-behavior-y: none }` (kills pull-to-refresh jank inside the standalone app; browser refresh still available in tab mode via toolbar).
- `-webkit-tap-highlight-color: transparent` globally; `touch-action: manipulation` on `.btn`, `.chip`, `.filter-pill`, `.tab`, links.
- **Touch-target standard:** on `<640px`, `.btn` gets `min-height: 44px`; `.btn-sm` 40px; `.filter-pill`, `.chip`, `.tab` get taller mobile padding to reach ≥40px visual / ≥44px hit (padding or `::after` hit-area extension where visuals must stay small, e.g. garage icon buttons use `p-2.5` + `-m-1`).
- **Input zoom fix:** `.field` (and Combobox input, textarea) becomes `font-size: 16px` under 640px, `text-sm` from `sm:` up. Same for the ZIP inline input.
- `.scrollbar-none` utility (hide scrollbars on horizontal scroll rows while keeping scrollability).

## Section 2 — Navigation

**New `src/components/BottomNav.tsx`**
- Renders only under `sm:` (`sm:hidden`), `fixed inset-x-0 bottom-0 z-40`, white/95 + backdrop-blur + top border (mirrors header), content height ~56px + `env(safe-area-inset-bottom)` padding.
- Three tabs (grid-cols-3, each a ≥44px target): **Search** (RadarMark or Search icon), **Watchlist** (Bookmark + existing count badge), **Account** (User icon, shows "Account" or first name).
- Props: `active: 'search' | 'watchlist' | 'account'`, `watchlistCount`, `onSearch`, `onWatchlist`, `onAccount`. Active tab = brand-600 icon+label; inactive = slate-500. `<nav aria-label="Primary">`, `aria-current="page"` on active.
- Tapping Search while already on the search flow calls `goHome()` (native-app convention).

**App.tsx**
- Header: Watchlist and Account buttons become `hidden sm:inline-flex` (they live in the tab bar on mobile); logo + theme toggle remain. Headroom behavior unchanged.
- `<main>` bottom padding: `pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-10`.
- Footer already sits above the padding; no change beyond inheriting it.
- Hero compression under `sm:`: headline `text-4xl` (from `text-5xl`), badge margins tightened, the three value-prop chips render as a single horizontal scroll row (`overflow-x-auto scrollbar-none`) instead of wrapping — goal: CarSelector's top edge visible on a 667px-tall viewport.
- Toaster stays top-center (bottom is now occupied).

**ResultsList compare bar**
- `bottom-6` → `bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-6`.

**New `src/components/StickyActionBar.tsx`**
- Mobile-only (`sm:hidden`) fixed bar sitting directly above BottomNav (`bottom-[calc(3.5rem+env(safe-area-inset-bottom))]`), white/95 blur + top border, horizontal padding, renders children (a full-width primary button). Used by CarSelector (below); reusable for future steps.

## Section 3 — Sheets (vaul)

**`Modal.tsx` rework — same public API** (`label`, `onClose`, `children`, `maxWidth`).
- New `useIsMobile()` hook (`matchMedia('(max-width: 639px)')`, updates on change).
- **Desktop (≥640px):** existing centered dialog implementation unchanged (focus trap, Escape, backdrop, scroll lock).
- **Mobile:** vaul `Drawer.Root` (open, `onOpenChange` → `onClose`) with `Drawer.Overlay` (same dim/blur), `Drawer.Content`: rounded-t-3xl, drag handle bar, `max-h-[92dvh]`, internal `overflow-y-auto` content area, `pb-safe`. `aria-label` passed through (vaul/Radix supplies dialog role, focus management, Escape).
- Nested case: RepairGuideModal opens from PartDetailModal — vaul supports stacked drawers; both render as siblings exactly as today.

**Consumers**
- **PartDetailModal:** content already stacks under `md:`. Footer actions become a sticky bottom row inside the sheet (`sticky bottom-0`, bg, border-t, `pb-safe`): Add to Watchlist + View on eBay full-width; the redundant "Close" button is `hidden sm:inline-flex` (swipe/handle/backdrop close on mobile).
- **ComparisonModal:** unchanged content; its `overflow-x-auto` table scrolls horizontally inside the sheet.
- **VehicleHealthModal / RepairGuideModal / others:** inherit sheet behavior automatically; touch-target sweep only.

## Section 4 — Surface redesigns

**CarSelector**
- Sticky mobile CTA: when `canConfirm`, render `StickyActionBar` with "Continue to parts" (the inline button stays for desktop and remains in DOM flow on mobile as well — the sticky bar is an *additional* affordance; both call `onConfirm`). Bar hidden while any modal/sheet is open (z-order handles it).
- Garage card icon buttons (Activity, X): `p-2.5 -m-1` for ≥40px hit areas.
- Trim buttons / vehicle-type segmented control: mobile `py-3` (≥44px).
- VIN row: unchanged layout (input flex-1 + button), inherits 16px/44px fixes; add `autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="go"`.

**PartSelector**
- Tab row: `flex` → `flex overflow-x-auto scrollbar-none snap-x` with `shrink-0 snap-start whitespace-nowrap` tabs (`.tab` loses `flex-1` on mobile via wrapper class), each ≥44px tall. All 5 labels stay full-text.
- Quote item rows: action column (`All listings` / `View`) becomes a full-width horizontal row *below* the row content on `<sm` (`flex-col` item layout), buttons ≥40px.
- Symptom example chips: horizontal scroll row on mobile instead of wrap (saves vertical space above the fold).
- Photo tab already mobile-first (`capture="environment"`); no change beyond button sizing.

**ResultsList**
- **Mobile toolbar (`<sm`):** single horizontal scroll row (`overflow-x-auto scrollbar-none`): `[Filters (n)]` button + condition segmented control + sort select. Desktop toolbar unchanged.
- **New filter sheet** (opened by the Filters button, rendered via `Modal` so it's a sheet on mobile): contains Hide overseas (switch-style row, 44px), Arrives within a week (switch row), Min seller rating (full-width slider + value), Delivery ZIP (16px numeric input), and "Clear all filters". Filter state stays in ResultsList (usePersistedState) and is passed down — no state moves.
- Filters button badge = count of active non-default filters (condition ≠ all counts, overseas, fast delivery, minRating > 0, zip set).
- **Header row mobile:** one 44px back button (chevron → part step) + title block; "Vehicle" back remains desktop-only (StepIndicator + logo cover it on mobile); Save Search and Share become 44px icon buttons with `aria-label`s (text from `sm:`). Save-state feedback moves to a toast on mobile (icon button can't show "Log in to save" text) — sonner already present.
- Compare bar repositioned (Section 2).

**ListingCard**
- Mobile layout: 80px image + rank badge, title `line-clamp-2`, price block aligned right of title row; badges wrap as today.
- Actions on mobile: `Buy on eBay` (primary, `flex-1`, 44px) + Watch (44px, icon+short label) + Compare (44px). "Click for Detailed View" becomes `hidden sm:inline-flex`; the whole card remains tappable (existing behavior) and gains a subtle right-edge chevron on mobile as the affordance.
- Best Value tooltip: hover-only → click/tap-toggled (`useState`, `aria-expanded`, closes on outside tap); hover still works on desktop.

**CartPanel (Watchlist)**
- Header action buttons ≥44px; on mobile the "Search" back button is redundant with the tab bar → `hidden sm:inline-flex`.
- Item rows: `<sm` layout stacks — image+title/meta block, then price + actions row full-width beneath (Buy `flex-1`, Remove 44px icon).
- Totals footer stacks on mobile; "Clear Watchlist" stays a ≥44px target.
- CompareTable keeps `overflow-x-auto` (fine on mobile).

**Dashboard**
- Inherits 16px inputs and 44px buttons. Tabs are already large. Card grids already 1-col on mobile. Back/Logout sized up. No structural change.

## Section 5 — Forms, performance, accessibility, testing

**Forms**
- 16px mobile inputs (foundation). `enterKeyHint`: "go" (VIN), "search" (part search combobox, symptom submit), "done" (ZIP). `autoCapitalize="characters"` on VIN + DTC inputs. ZIP keeps `inputMode="numeric"` and gains `pattern="[0-9]*"`. Auth inputs keep existing `autoComplete` attributes.
- Combobox: option rows `py-3` (≥44px), `max-h-72` → `max-h-60` on mobile, input 16px, `enterKeyHint` prop threaded.
- Validation/errors: existing inline patterns kept (they're already honest and adjacent to fields).

**Performance**
- Preconnect `https://i.ebayimg.com`.
- Google Fonts: grep for actually-used weights; drop unused ones from the URL (e.g. Barlow 500/600 if only 700 is used). Verify visually after.
- `decoding="async"` on listing/thumbnail images (width/height + lazy already present).
- Bundle: lazy views/modals already in place; `npm run build` before/after to confirm no regression from vaul (~5 kB gz).

**Accessibility**
- BottomNav: `nav[aria-label="Primary"]`, `aria-current`, visible labels under icons (not icon-only).
- Sheets keep dialog semantics (Radix); `aria-label` threaded through Modal.
- Tooltip → tap-toggle with `aria-expanded` + `aria-describedby`.
- Icon-only mobile buttons (Save/Share/Watch/Remove) all have `aria-label`s.
- Existing global `prefers-reduced-motion` rule covers new transitions; verify sheet open/close degrades to near-instant.
- Contrast: no new sub-AA text; keep the established slate-500 floor for small text.

**Testing / verification (definition of done)**
- `npm run build` (tsc + vite) passes; `npm test` (server, node:test) passes; `npm run lint` passes.
- Dev-server walkthrough at 375×667 (iPhone SE), 393×852 (iPhone 15 Pro), 430×932 (Pro Max) — via DevTools emulation / preview tooling (per project memory: use snapshot/inspect, not screenshot, which times out on eBay images).
- Flows: full search (car→part→results), VIN decode, garage save/health, all 5 PartSelector tabs, filter sheet round-trip (state persists), listing detail sheet + swipe dismiss, comparison sheet, watchlist add/remove/compare/check-prices, auth screen render + dashboard tabs, dark mode across all new surfaces, bottom-nav navigation from every view.
- Final deliverable: mobile UX report (audit summary, implemented improvements, perf/a11y notes, remaining issues, future recommendations, readiness score 0–100).

## Non-goals

- No service worker / offline mode (honesty guardrail).
- No router, no page-transition/animation library, no swipe-back gesture.
- No desktop redesign; `sm:`+ appearance unchanged except shared fixes (tooltip tap-toggle, font-weight trim).
- No changes to the CJ affiliate script, dark-mode `!important` override block, or server code.
- No separate mobile bundle/version — one responsive codebase.

## Risks

- **vaul + existing focus-trap Modal coexistence:** mitigated by branching per breakpoint inside one component; desktop path is untouched code.
- **Fixed bars vs. on-screen keyboard:** iOS may float fixed elements above the keyboard; acceptable for tab bar (standard behavior). StickyActionBar renders only on the car step where the keyboard is transient. Documented as a known minor issue if observed.
- **eBay images in sheets:** no new loading behavior; lazy + async decoding already bounded.
