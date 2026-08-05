# Monetization operations

CarPartsRadar's primary revenue model is affiliate commission from users who
leave a search result to buy a physical car part. Price alerts, watchlists, and
job companion parts support that funnel by bringing users back and increasing
the number of useful retailer visits.

## Production configuration

Never add credentials or private keys to the client applications.

### Website

- Set `EBAY_EPN_CAMPAIGN_ID` on the API/server deployment after the website is
  approved by eBay Partner Network.
- Set `VITE_POSTHOG_KEY` and, if needed, `VITE_POSTHOG_HOST` on the website
  deployment to enable conversion analytics. The PostHog project key is public;
  admin or personal keys must never use a `VITE_` variable.
- Keep the Amazon website tag distinct from any mobile-app tag.

### iOS and Android

Affiliate programs treat an installed app as a separate promotional property.
The app intentionally fails closed: ordinary retailer links continue working,
but mobile affiliate attribution stays disabled until approval is recorded.

- Obtain written eBay Partner Network approval for the installed app.
- Then set `EBAY_EPN_MOBILE_APPROVED=1` on the API deployment and
  `EXPO_PUBLIC_EPN_MOBILE_APPROVED=1` in the mobile build profile.
- Obtain Amazon Associates approval for the mobile app before setting
  `EXPO_PUBLIC_AMAZON_MOBILE_TAG` to its dedicated tracking ID.
- Rebuild the app after changing an `EXPO_PUBLIC_*` value; these values are
  compiled into the client bundle.

Until both server and app approval flags are enabled, eBay mobile requests use
ordinary non-affiliate links. Shared links are always stripped of affiliate
parameters so private messages and social posts do not become an unapproved
distribution channel.

## Revenue funnel

The website emits the following privacy-conscious PostHog events without email
addresses or account identifiers:

1. `Searched Part`
2. `Search Results Viewed`
3. `Retailer Clicked`
4. `Added to Watchlist`
5. `Price Alert Created`

Create a funnel from search to result to retailer click. Review conversion by
`placement`, `retailer`, `part`, and `fitmentStatus`. The eBay API also receives
a channel-specific affiliate reference ID so website and approved mobile
performance can be separated in EPN reporting.

Track these operating metrics weekly:

- Search-to-results completion rate
- Results-to-retailer click-through rate
- Revenue per retailer click
- Revenue per search
- Price-alert creation and return rate
- Watchlist-to-retailer click-through rate

Do not buy traffic until revenue per visit and the click-to-sale conversion rate
are measured. A paid campaign is sustainable only when expected commission per
visitor exceeds acquisition cost after refunds and attribution loss.

## Compliance checks before release

- Keep the affiliate disclosure visible near retailer links, not only in the
  footer.
- Keep the full affiliate-disclosure page publicly reachable.
- Open retailer pages in the system browser rather than an embedded checkout.
- Do not enable mobile tracking IDs until each mobile app/property is approved.
- Recheck program terms whenever adding a retailer or changing link behavior.
- Test that a mobile build without approval flags contains no affiliate tag.

Subscriptions, paid reports, sponsored placement, and advertising are not
enabled by this implementation. Those models require separate pricing,
entitlement, disclosure, and App Store purchase decisions; they should be added
only after the affiliate funnel provides enough data to justify them.
