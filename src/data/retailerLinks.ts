// Smart deep links to major auto parts retailers.
// These open the retailer's own search results pre-filled with the vehicle + part.
// This is the most reliable and ToS-compliant way to show pricing from stores
// that don't offer public product APIs.
import type { LucideIcon } from 'lucide-react'
import {
  ShoppingCart,
  Package,
  Wrench,
  BookOpen,
  Car,
  Store,
  Search,
  Zap,
} from 'lucide-react'

export type RetailerLink = {
  name: string
  buildUrl: (query: string) => string
  icon: LucideIcon
  color: string
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
    icon: ShoppingCart,
    color: 'text-orange-600',
  },
  {
    name: 'AutoZone',
    buildUrl: (query) =>
      `https://www.autozone.com/searchresult?searchText=${q(query)}`,
    icon: Wrench,
    color: 'text-red-600',
  },
  {
    name: 'RockAuto',
    buildUrl: (query) =>
      `https://www.rockauto.com/en/partsearch/?partname=${q(query)}`,
    icon: Car,
    color: 'text-slate-700',
  },
  {
    name: "O'Reilly",
    buildUrl: (query) =>
      `https://www.oreillyauto.com/search?q=${q(query)}`,
    icon: BookOpen,
    color: 'text-green-700',
  },
  {
    name: 'NAPA',
    buildUrl: (query) =>
      `https://www.napaonline.com/en/search?text=${q(query)}`,
    icon: Package,
    color: 'text-blue-700',
  },
  {
    name: 'Advance Auto',
    buildUrl: (query) =>
      `https://shop.advanceautoparts.com/search?searchTerm=${q(query)}`,
    icon: Zap,
    color: 'text-red-700',
  },
  {
    name: 'Walmart',
    buildUrl: (query) =>
      `https://www.walmart.com/search?q=${q(query)}`,
    icon: Store,
    color: 'text-blue-600',
  },
  {
    name: 'Summit Racing',
    buildUrl: (query) =>
      `https://www.summitracing.com/search?searchTerm=${q(query)}`,
    icon: Car,
    color: 'text-slate-800',
  },
  {
    name: 'Google Shopping',
    buildUrl: (query) =>
      `https://www.google.com/search?tbm=shop&q=${q(query)}`,
    icon: Search,
    color: 'text-sky-600',
  },
]
