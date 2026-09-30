// Smart deep links to major auto parts retailers.
// These open the retailer's own search results pre-filled with the vehicle + part.
// This is the most reliable and ToS-compliant way to show pricing from stores
// that don't offer public product APIs.

export type RetailerLink = {
  name: string
  buildUrl: (query: string) => string
}

const q = encodeURIComponent

// Amazon Associates tag — generates referral credit
const AMAZON_ASSOCIATE_TAG = 'carpartsradar-20'

// Highly optimized retailer links (prioritized by usefulness + conversion)
export const retailerLinks: RetailerLink[] = [
  {
    name: 'Amazon',
    buildUrl: (query) =>
      `https://www.amazon.com/s?k=${q(query)}&tag=${AMAZON_ASSOCIATE_TAG}`,
  },
  {
    name: 'AutoZone',
    buildUrl: (query) =>
      `https://www.autozone.com/searchresult?searchText=${q(query)}`,
  },
  {
    name: 'RockAuto',
    buildUrl: (query) =>
      `https://www.rockauto.com/en/partsearch/?partname=${q(query)}`,
  },
  {
    name: "O'Reilly",
    buildUrl: (query) =>
      `https://www.oreillyauto.com/search?q=${q(query)}`,
  },
  {
    name: 'NAPA',
    buildUrl: (query) =>
      `https://www.napaonline.com/en/search?text=${q(query)}`,
  },
  {
    name: 'Advance Auto',
    buildUrl: (query) =>
      `https://shop.advanceautoparts.com/search?searchTerm=${q(query)}`,
  },
  {
    name: 'Walmart',
    buildUrl: (query) =>
      `https://www.walmart.com/search?q=${q(query)}`,
  },
  {
    name: 'Summit Racing',
    buildUrl: (query) =>
      `https://www.summitracing.com/search?searchTerm=${q(query)}`,
  },
  {
    name: 'Google Shopping',
    buildUrl: (query) =>
      `https://www.google.com/search?tbm=shop&q=${q(query)}`,
  },
]
