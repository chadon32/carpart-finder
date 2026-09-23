import { isMobileAmazonAffiliateEnabled } from '@/data/retailerLinks'
import { isEbayEpnMobileApproved } from '@/lib/outboundLinks'

export const hasMobileAffiliatePrograms = isEbayEpnMobileApproved || isMobileAmazonAffiliateEnabled
