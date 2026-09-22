# CarPartsRadar SEO implementation and release audit

Research and implementation date: September 22, 2026. Production: https://carpartsradar.com. Baseline source: `e891701` on `ios-app`.

**Final release status: implemented, tested and pushed, but NOT currently live.** Deployment `dpl_HKJaYPG2f7BJ6hyBxGqDbyHjsJDk` built successfully and passed SEO checks, then an actual production search exposed an unavailable Supabase rate-limit RPC. It was rolled back to the preceding working production deployment, `dpl_6vEBNk2ia2hCxT47NP5yunYYHbsw`. Search recovery was verified (HTTP 200, fitment contract 2, 14 broader results). Applying/checking the pending database migration needs user approval before redeployment.

## Business, audience and coverage

Confirmed from repository and public pages: CarPartsRadar compares third-party automotive listings, exposes compatibility evidence, supports saved searches/watchlists and optional accounts, and sends shoppers to retailers. It is not the retailer. Affiliate commissions are the stated monetization model; actual revenue and network approval were not verified. The useful conversion is a qualified retailer click, not simply a signup.

The working market is English-language US drivers, DIY buyers and parts professionals, inferred from USD prices, ZIP-code shipping and NHTSA vehicle data. No new service locations or business credentials were asserted.

Architecture: React 19 / TypeScript / Vite client, query-string vehicle/search state, Express API through Vercel, and build-generated static HTML for eight buying guides and six trust/legal pages plus the guide index. Static guides already contain complete copy without JavaScript; no framework migration is justified. The homepage has useful initial metadata and a no-JavaScript resource fallback; interactive vehicle lookup requires JavaScript.

Coverage: all 16 sitemap URL definitions and generated page metadata/local links; shared article, directory and trust-page templates; homepage and representative vehicle/search URLs; 404 and duplicate-index behavior. Browser review includes guide navigation and the comparison entry point. Nine browser/viewport projects exercise representative journeys, not every possible vehicle or retailer combination. No real purchase, account deletion, or production alert was submitted.

## Priorities and evidence

| Priority | Finding | Impact / confidence / effort / risk | Implementation |
| --- | --- | --- | --- |
| P0 | No sitewide crawl blocker confirmed. A nonexistent production URL correctly returned 404. | Preserve working behavior. | No catch-all rewrite or URL migration. |
| P1 | Static metadata plus two Helmet instances produced three descriptions on rendered results. React 19 hoists metadata rather than replacing the static tags. | High / high / small / low | One app metadata owner; explicitly relinquish tagged initial metadata at startup. Regression-test uniqueness and navigation. |
| P1 | Arbitrary search queries had no server-side noindex and claimed the homepage canonical. | High / high / small / medium | Query-specific HTTP noindex, rendered noindex and no search canonical; canonical homepage preserved for referral parameters. |
| P1 | Different brands/conditions/items were grouped as one Product with AggregateOffer. | High / high / small / low | Removed misleading Product markup. No replacement offers or ratings invented. |
| P1 | Article recommendations rotated through array order, with no in-article conversion section or jump navigation. | High / high / small / low | Topic-curated recommendations, jump links, comparison CTA and clear affiliate context across all eight guides. |
| P1 | Desktop article headline consumed nearly an entire screen; repeated workbench photo preceded the answer. | Medium / high / small / low | More compact responsive heading, earlier takeaways/navigation, lazy photo after the introduction. |
| P2 | Sitemap and feed stamped all pages with one global date; Article lacked headline and author identity matching the visible byline. | Medium / high / small / low | Per-guide explicit modification dates, omit unknown timestamps, improve article/breadcrumb/social metadata. |
| P2 | `/index.html` duplicated `/`; affiliate script blocked parsing. | Medium / high / small / low | Permanent index redirect retaining query; defer existing affiliate script without changing its URL/permissions. |

Google's [product snippet guidance](https://developers.google.com/search/docs/appearance/structured-data/product-snippet) limits that feature to a specific product or its variants, not a heterogeneous listing page. The removal corrects meaning; it is not a claimed ranking gain.

Google's [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) calls for accurate significant-modification dates. The eight guides were materially changed in this release; their stored dates reflect that. Unknown original publication dates are omitted rather than fabricated. Do not update these dates merely because a build runs.

The article graph uses the visible title/byline/image and the visible breadcrumb trail, following [Article recommendations](https://developers.google.com/search/docs/appearance/structured-data/article). It does not assert professional credentials, review ratings, physical premises, inventory, or rich-result eligibility. A single existing generic image remains a limitation. JSON syntax and content correspondence are tested; Google's hosted Rich Results Test and Search Console URL Inspection are not claimed as executed.

Conditional response headers follow [Vercel configuration documentation](https://vercel.com/docs/project-configuration/vercel-json). `robots.txt` remains crawlable so crawlers can see noindex. API authentication/RLS remain unchanged; noindex is not a security control.

## Search intent and competitor research

Queries sampled: car-part fitment / VIN / OEM compatibility; comparing auto-part prices, shipping and core charges; brake pad selection. Research is qualitative, not a localized rank-tracking or keyword-volume study. No Search Console query export, analytics report, paid keyword dataset, rankings or revenue figures were available in this pass. The existing verification meta tag is not proof of indexing or property access.

Three directly inspected organic-shopping references:

| Reference | Useful observed pattern | CarPartsRadar application |
| --- | --- | --- |
| [RockAuto choosing-parts help](https://www.rockauto.com/help/?page=2) | Question-led navigation exposes application qualifiers, quantity, core definitions, shipping and included components. | Make answers easy to jump to; connect fitment and true cost. Do not copy catalog-fit guarantees. |
| [eBay Guaranteed Fit](https://pages.ebay.com/motors/ebay-guaranteed-fit/) | Explains vehicle selection, listing eligibility and protection limitations alongside a shopping CTA. | Keep compatibility evidence and seller-policy caveats adjacent to the next action. CarPartsRadar does not offer eBay's guarantee itself. |
| [GetOEMParts OEM-number guide](https://www.getoemparts.com/blog/finding-the-right-oem-part-number-for-your-vehicle) | A short answer, numbered checks, FAQs and category links lead research readers toward vehicle-specific shopping. | Existing substantive guidance should lead into comparison rather than ending with unrelated articles. |

AutoZone's brake-pad guide appeared in the search sample, but subsequent full-page retrieval failed; it is not counted as a completed full-page inspection. Competitor text was not copied.

### Keyword-to-page map

All existing URLs are preserved. Related queries belong together, not on near-duplicate keyword pages. Priorities reflect product fit and observed intent, not invented demand estimates.

| Existing URL | Main intent and related queries | Need / conversion | Action and evidence |
| --- | --- | --- | --- |
| `/` | Compare car-part prices; auto-part price comparison by vehicle | Find applicable listings; retailer click | Preserve search-first design; link fitment/OEM/total-cost support. Marketplace comparison is the actual product. |
| `/guides.html` | Car-part buying guides; how to choose replacement parts | Find the right question; open a guide | Preserve crawlable eight-guide directory and clear categories. |
| `/guides/how-to-confirm-car-part-fitment.html` | Will this part fit; check part compatibility; VIN vs part number | Avoid wrong part; start vehicle comparison | Jump links and relevant follow-ons. Competitors prioritize vehicle identity and qualifiers. |
| `/guides/oem-vs-aftermarket-car-parts.html` | OEM vs aftermarket; remanufactured vs new | Weigh condition/quality/risk; compare listings | Keep balanced existing guidance; link fitment and real cost. |
| `/guides/brake-pad-buying-guide.html` | Which brake pads; ceramic vs semi-metallic; axle/package fit | Select material and correct package; compare | Preserve technical/safety caveats, add navigation and CTA. |
| `/guides/alternator-buying-guide.html` | Alternator fitment; output; core charge | Match specifications and deposit terms; compare | Link total cost, starter and fitment topics. |
| `/guides/starter-motor-buying-guide.html` | Starter buying guide; remanufactured starter; core returns | Avoid diagnosis/fitment confusion; compare | Link charging-system companion and total-cost guide. |
| `/guides/oxygen-sensor-buying-guide.html` | Upstream vs downstream; bank/sensor position; direct fit | Resolve position/connector; compare | Keep distinct sensor intent, link compatibility and OEM guidance. |
| `/guides/shocks-vs-struts-buying-guide.html` | Shocks vs struts; complete assemblies; alignment cost | Identify assembly and repair scope; compare | Keep suspension guidance; link total cost and fitment. |
| `/guides/compare-total-car-part-cost.html` | Core charge refund; shipping/quantity; true car-part cost | Compare complete cost; compare listings | Added an explicitly hypothetical worked example with checked arithmetic, plus jump links/CTA. RockAuto surfaces the same cost questions. |

Trust routes `/about.html`, `/methodology.html`, `/contact.html`, `/privacy.html`, `/terms.html`, `/affiliate-disclosure.html` remain indexable and self-canonical. They support credibility, not separate commercial keyword targets. Existing policy wording was not rewritten. No location, brand or vehicle doorway pages were created.

### Indexability policy

- Index: canonical homepage, guide index, eight articles, six trust/legal pages.
- Do not index: vehicle/part selection and results parameter URLs, API responses, rendered private account/watchlist views. Searches remain shareable and usable.
- Referral-only homepage parameters such as `?guide=...` retain the clean homepage canonical. Internal CTAs deliberately avoid UTMs that could overwrite acquisition attribution.
- Missing paths remain 404. `/index.html` redirects to `/` once and preserves query data. Other public URLs were not renamed.
- No translations exist, so no hreflang was added. There are no separate crawlable pagination pages in the audited implementation.
- Preview/staging indexing protection needs environment-level verification for any separately shared host; no production-wide noindex was introduced.

## Verification and measurements

- `npm run build`: passed (includes application TypeScript build).
- `npm run lint`: passed for web/API/tooling and mobile source.
- `npm run typecheck:e2e`: passed.
- `npm test`: 213 passed, zero failed/skipped.
- Focused Playwright run: 27 passed, covering SEO, guide accessibility and vehicle/part/results history across Chromium, Firefox and WebKit at desktop/phone/tablet sizes. No unexpected first-party runtime errors in these flows. The full unrelated end-to-end suite was not rerun.
- Generated-page tests check local links, unique anchors, contextual guide targets, JSON-LD agreement, dates, sitemap coverage and configuration rules.
- Initial testing exposed duplicate descriptions (fixed) and a test server that stripped canonical links along with external fonts (fixed, regression-tested). A phone test initially expected the desktop-only subtitle in a button name; the responsive locator was corrected. Final pass counts above are reruns, not the initial failures.
- No-JavaScript article content remains complete. Current hero/brand, APIs, account workflows, source verification tokens and affiliate destinations are preserved.

Performance: before/after three cold runs per scenario per viewport (27 runs each), same local Chrome, 4x CPU slowdown, 1.6 Mbps down / 750 Kbps up / 150 ms latency, cache disabled, external requests blocked. These are lab samples using deterministic API fixtures, not production field Core Web Vitals or a Lighthouse score. Deferred third-party script benefits are not quantified by a fixture that blocks third parties. Raw evidence: `seo-2026-09-22-before.json` and `seo-2026-09-22-after.json` beside this report.

| Lab scenario | Median LCP before → after | p75 CLS before → after |
| --- | --- | --- |
| Desktop home | 1,240 → 1,300 ms | 0 → 0 |
| Desktop results | 1,748 → 1,764 ms | 0.0006 → 0.0006 |
| Desktop delayed results | 2,360 → 2,392 ms | 0.0006 → 0.0006 |
| Phone home | 1,252 → 1,260 ms | 0 → 0 |
| Phone results | 1,704 → 1,724 ms | 0.0032 → 0.0032 |
| Phone delayed results | 2,328 → 2,348 ms | 0.0032 → 0.0032 |
| Tablet home | 1,220 → 1,260 ms | 0 → 0 |
| Tablet results | 1,500 → 1,512 ms | 0.0008 → 0.0008 |
| Tablet delayed results | 1,516 → 1,504 ms | 0.0008 → 0.0008 |

This is **not a demonstrated speed gain**: most median LCP samples are slightly slower, with unchanged layout shift. The added links/metadata increase initial JavaScript gzip from 95,637 to 96,085 bytes (+448 bytes / 0.47%); removing results schema reduces the lazy results chunk (Vite gzip display 12.23 → 11.73 kB). Conditions are compatible. The comparison flags one percentage regression: tablet results local TTFB p75, 3.25 → 4.10 ms (+0.85 ms / 26.2%). No artificial threshold adjustment or claim that the strict comparison gate passed is made. This small localhost timing change is recorded rather than treated as a proven production slowdown. Larger samples and field data are needed for that inference.

### Deployment verification and rollback evidence

Source implementation commit: `e966e5f`, pushed to `origin/ios-app`. Deployed from a clean detached worktree to the existing Vercel project, with unrelated local files excluded. Vercel reported READY and aliased the deployment to carpartsradar.com.

On that deployment, all 16 sitemap pages returned 200 with distinct metadata, their own canonical, one initial-HTML main heading, and parseable schema. Search/API noindex headers, referral-only homepage indexability, missing-page 404, `/index.html` 308 preserving query, and `/api/health` passed. Manual desktop and 390px phone inspection confirmed the revised guide, no horizontal overflow, working guide-to-comparison link, one rendered description, and the clean homepage canonical. The guide/entry flow produced no logged browser errors at that check.

However, a real parts search returned 503. The Vercel runtime log was `[rate-limit] shared store unavailable { limiter: 'search', errorCode: 'PGRST202' }`. The repository calls `consume_api_rate_limit`; Supabase did not expose the expected function/signature through PostgREST. Its definition is already present in `server/supabase-rate-limit-migration.sql`, introduced in earlier work, not this SEO change. The preceding production deployment was 31 days old: testing local HEAD was not sufficient evidence of production-database compatibility. Whether the function is absent or the schema cache/signature is stale still needs database inspection.

Rollback completed successfully to `carpart-finder-5jeekz1i8-chadon32s-projects.vercel.app`. The same public search then returned 200, `results: 0`, `fallbackResults: 14`, and `fitmentContractVersion: 2`. No compatibility guarantee is inferred from fallback listings. No database change, security fallback, or removal of rate limiting was performed.

**P0 release blocker:** confirm the intended Supabase project, inspect the existing RPC, then apply the narrow existing rate-limit migration only with approval. Verify anonymous/authenticated roles cannot execute it and a service-role request can; rerun a representative search and account-rate-limit checks before promoting the SEO release. Health-only checks cannot catch this prerequisite. `scripts/check-seo.mjs` now includes one read-only actual search and rejects non-200 responses so this failure cannot be mistaken for a complete release again.

The benchmark measurements above describe the local source, not the rolled-back live website. SEO improvements and revised guides remain on GitHub and in the ready Vercel deployment, but are not active on the public domain after rollback.

## Changed-file inventory

- `index.html`: initial metadata ownership markers; nonblocking existing affiliate loader.
- `src/main.tsx`: remove only tagged bootstrap metadata before React takes ownership.
- `src/App.tsx`: one metadata owner, dynamic search title, indexability/canonical handling, contextual homepage guide links.
- `src/components/ResultsList.tsx`: remove duplicate metadata and inaccurate aggregate-product schema.
- `vercel.json`: index redirect and search/API noindex headers; existing security headers, API rewrite and cron preserved.
- `scripts/editorial-content.mjs`: explicit per-guide modification dates and related topics; original hypothetical cost example.
- `scripts/generate-editorial-pages.mjs`: article/byline/breadcrumb schema, social metadata, accessible jump links, lazy image, comparison CTA, truthful sitemap/feed dates.
- `public/editorial.css`: readable responsive article header, jump-target offsets, focus visibility, 44px jump targets, CTA and reduced-motion support.
- Regenerated `public/guides.html`, `public/about.html`, `public/methodology.html`, `public/contact.html`, `public/privacy.html`, `public/terms.html`, `public/affiliate-disclosure.html`.
- Regenerated `public/guides/how-to-confirm-car-part-fitment.html`, `oem-vs-aftermarket-car-parts.html`, `brake-pad-buying-guide.html`, `alternator-buying-guide.html`, `starter-motor-buying-guide.html`, `oxygen-sensor-buying-guide.html`, `shocks-vs-struts-buying-guide.html`, `compare-total-car-part-cost.html`.
- Regenerated `public/sitemap.xml` and `public/feed.xml`.
- `scripts/editorial-content.test.mjs`, `tests/web/seo.spec.ts`: regression coverage.
- `scripts/benchmark-web-lib.mjs`, `scripts/benchmark-web.test.mjs`: preserve canonical/alternate metadata in the isolated fixture server while stripping network-fetching third-party links.
- `scripts/check-seo.mjs`: read-only production smoke checks across every sitemap URL, response headers, 404, redirect and API health.
- This report, two raw benchmark reports, and README documentation.

Generated HTML is reviewed via generator diff and automated content/schema/link checks. Edit the source generator/content, not a single generated article. Unrelated untracked creative exports and scratch files are preserved and excluded from release staging.

## Remaining limitations and 30/60/90-day plan

### First 30 days: measurement and validation

1. In the verified Search Console property, inspect homepage, fitment guide and total-cost guide; submit/check `/sitemap.xml`. Check canonical/indexed status and search exclusions after recrawl. Local validation is not proof Google indexed anything.
2. Export the prior 28 and 90 days of clicks, impressions, CTR, position, query, page, country and device. Segment branded vs nonbranded and guide vs homepage. Record this release date; compare equal-length periods and year-over-year where data exists.
3. Inspect existing PostHog `Searched Part` and `Retailer Clicked` events and network attribution reports. Pageview capture is currently disabled; static guides have no analytics script. A full organic-session-to-guide-to-retailer conversion rate is **not currently verifiable**. Define a minimal consent/privacy-compatible attribution implementation before adding tracking; no duplicate tracker was introduced here.
4. Define conversion rate as qualified retailer-click sessions / eligible organic landing sessions, with consistent session and source attribution. Exclude internal/QA traffic and distinguish outbound clicks from confirmed affiliate orders/commission. Until the denominator exists, report counts separately rather than a fabricated conversion rate.
5. Validate deferred affiliate link rewriting in the network's approved test workflow; no commission or attribution success is claimed from a browser click.

### By 60 days: improve proven pages, not volume

1. Use query/page exports to prioritize existing guides with relevant impressions and weak CTR or engagement. Test one title/description hypothesis at a time without changing the URL.
2. Add original, permissioned part-label/connector/quantity photographs and annotated examples to the existing fitment guide. Distinct purpose: show evidence readers can inspect. Requires genuine source images; do not fabricate hands-on testing.
3. Consider an embedded delivered-cost/core-deposit worksheet in the existing total-cost guide. Its purpose is arithmetic with explicit assumptions, not tax advice or invented live quotes. Link it from alternator/starter guides. Keep one URL unless usage proves a separately shareable tool is needed.

### By 90 days: expand only validated needs

1. If search data supports it, draft one distinct guide to interpreting kit quantity and included hardware, using real permissioned listing examples. Link it from brakes/total-cost and the directory. Do not publish unsupported merchant-policy claims.
2. Request genuine editorial review from an automotive professional only with approval; publish credentials only after confirmation. Seek legitimate citations through a useful original worksheet or documented methodology, not paid links or bulk outreach.
3. Evaluate real-user Core Web Vitals and conversions alongside organic visibility, supplier availability, marketing changes and seasonality. Three-run lab variation is not a ranking or revenue improvement.

## Deployment and rollback

The user's “and deploy” authorizes this production website release; no mobile binary submission, database migration, domain change, paid purchase, or new service is included. Use the existing linked Vercel project. Deploy a clean tracked-source checkout so the user's unrelated scratch files are not uploaded.

Rollback: promote the preceding successful Vercel production deployment if a live regression appears, then revert the focused SEO commit and redeploy. There is no data/schema migration to reverse. Preserve the existing production environment variables and authentication configuration. Validate homepage, a search URL, one guide, `/api/health`, and the sitemap after either release or rollback.
