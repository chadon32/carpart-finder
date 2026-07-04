// Deep links into each retailer's own search results, pre-filled with the
// vehicle + part query. This is the free, ToS-safe way to cover retailers
// that offer no public API (AutoZone, NAPA, O'Reilly, RockAuto) — we link to
// their sites instead of extracting their data.
export type RetailerLink = {
  name: string
  buildUrl: (query: string) => string
}

const q = encodeURIComponent

// Amazon Associates tracking ID — every Amazon link below earns referral
// credit toward the 3 qualifying sales needed to unlock the Product
// Advertising API. Not a secret; affiliate tags are meant to be public.
const AMAZON_ASSOCIATE_TAG = 'carpartsradar-20'

export const retailerLinks: RetailerLink[] = [
  { name: 'AutoZone', buildUrl: (query) => `https://www.autozone.com/searchresult?searchText=${q(query)}` },
  { name: "O'Reilly", buildUrl: (query) => `https://www.oreillyauto.com/search?q=${q(query)}` },
  { name: 'NAPA', buildUrl: (query) => `https://www.napaonline.com/en/search?text=${q(query)}` },
  { name: 'RockAuto', buildUrl: (query) => `https://www.rockauto.com/en/partsearch/?partname=${q(query)}` },
  {
    name: 'Amazon',
    buildUrl: (query) => `https://www.amazon.com/s?k=${q(query)}&tag=${AMAZON_ASSOCIATE_TAG}`,
  },
  { name: 'Walmart', buildUrl: (query) => `https://www.walmart.com/search?q=${q(query)}` },
  { name: 'Google Shopping', buildUrl: (query) => `https://www.google.com/search?tbm=shop&q=${q(query)}` },
]
