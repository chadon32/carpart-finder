// Retailer deep links mirrored from web src/data/retailerLinks.ts (icons
// dropped — lucide-react is web-only). Opens each store's own search
// pre-filled — the ToS-compliant way to compare stores without APIs.

export type RetailerLink = { name: string; buildUrl: (query: string) => string }

const q = encodeURIComponent

const amazonAssociateTag = process.env.EXPO_PUBLIC_AMAZON_MOBILE_TAG?.trim() ?? ''

export const isMobileAmazonAffiliateEnabled = amazonAssociateTag.length > 0

export function buildAmazonSearchUrl(query: string) {
  const search = `https://www.amazon.com/s?k=${q(query)}`
  return isMobileAmazonAffiliateEnabled ? `${search}&tag=${q(amazonAssociateTag)}` : search
}

export const retailerLinks: RetailerLink[] = [
  { name: 'Amazon', buildUrl: buildAmazonSearchUrl },
  { name: 'AutoZone', buildUrl: (query) => `https://www.autozone.com/searchresult?searchText=${q(query)}` },
  { name: 'RockAuto', buildUrl: (query) => `https://www.rockauto.com/en/partsearch/?partname=${q(query)}` },
  { name: "O'Reilly", buildUrl: (query) => `https://www.oreillyauto.com/search?q=${q(query)}` },
  { name: 'NAPA', buildUrl: (query) => `https://www.napaonline.com/en/search?text=${q(query)}` },
  { name: 'Advance Auto', buildUrl: (query) => `https://shop.advanceautoparts.com/search?searchTerm=${q(query)}` },
  { name: 'Walmart', buildUrl: (query) => `https://www.walmart.com/search?q=${q(query)}` },
  { name: 'Summit Racing', buildUrl: (query) => `https://www.summitracing.com/search?searchTerm=${q(query)}` },
  { name: 'Google Shopping', buildUrl: (query) => `https://www.google.com/search?tbm=shop&q=${q(query)}` },
]
