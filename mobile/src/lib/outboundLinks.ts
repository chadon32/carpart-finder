import { Alert } from 'react-native'
import * as WebBrowser from 'expo-web-browser'

const retailerDomains = [
  'ebay.com',
  'ebay.ca',
  'ebay.co.uk',
  'ebay.de',
  'ebay.com.au',
  'amazon.com',
  'amazon.ca',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.it',
  'amazon.es',
  'amazon.com.au',
  'amazon.co.jp',
  'autozone.com',
  'rockauto.com',
  'oreillyauto.com',
  'napaonline.com',
  'advanceautoparts.com',
  'walmart.com',
  'summitracing.com',
  'google.com',
  'aliexpress.com',
] as const

const ebayDomains = retailerDomains.filter((domain) => domain.startsWith('ebay.'))
const amazonDomains = retailerDomains.filter((domain) => domain.startsWith('amazon.'))
const ebayEpnParameters = new Set(['campid', 'customid', 'mkcid', 'mkevt', 'mkrid', 'toolid'])

export const isEbayEpnMobileApproved = process.env.EXPO_PUBLIC_EPN_MOBILE_APPROVED === '1'

function isDomainOrSubdomain(hostname: string, domains: readonly string[]) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
}

function removeQueryParameters(url: string, names: ReadonlySet<string>) {
  const hashIndex = url.indexOf('#')
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
  const queryIndex = beforeHash.indexOf('?')

  if (queryIndex === -1) return url

  const base = beforeHash.slice(0, queryIndex)
  const query = beforeHash.slice(queryIndex + 1)
  const kept = query.split('&').filter((entry) => {
    const separator = entry.indexOf('=')
    const encodedName = separator === -1 ? entry : entry.slice(0, separator)
    try {
      return !names.has(decodeURIComponent(encodedName.replace(/\+/g, ' ')).toLowerCase())
    } catch {
      return true
    }
  })

  return kept.length > 0 ? `${base}?${kept.join('&')}${hash}` : `${base}${hash}`
}

/** Validates a retailer URL and applies the mobile EPN approval gate. */
export function prepareOutboundUrl(rawUrl: string, eBayEpnApproved = isEbayEpnMobileApproved): string | null {
  const source = rawUrl.trim()
  if (!source) return null

  try {
    const parsed = new URL(source)
    const hostname = parsed.hostname.toLowerCase()
    if (parsed.protocol !== 'https:' || !isDomainOrSubdomain(hostname, retailerDomains)) return null

    return isDomainOrSubdomain(hostname, ebayDomains) && !eBayEpnApproved
      ? removeQueryParameters(source, ebayEpnParameters)
      : source
  } catch {
    return null
  }
}

/** Prepares a safe ordinary destination for sharing without affiliate attribution. */
export function prepareNonAffiliateShareUrl(rawUrl: string): string | null {
  const prepared = prepareOutboundUrl(rawUrl, false)
  if (!prepared) return null

  const hostname = new URL(prepared).hostname.toLowerCase()
  return isDomainOrSubdomain(hostname, amazonDomains)
    ? removeQueryParameters(prepared, new Set(['tag']))
    : prepared
}

export async function openOutboundLink(rawUrl: string) {
  const prepared = prepareOutboundUrl(rawUrl)
  if (!prepared) {
    Alert.alert('Unable to open link', 'This purchase link is unavailable. Please try another listing.')
    return false
  }

  try {
    await WebBrowser.openBrowserAsync(prepared)
    return true
  } catch {
    Alert.alert('Unable to open link', 'Your browser could not open this purchase link. Please try again.')
    return false
  }
}
