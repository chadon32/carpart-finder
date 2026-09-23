import { Text, View } from 'react-native'
import { isMobileAmazonAffiliateEnabled } from '@/data/retailerLinks'
import { hasMobileAffiliatePrograms } from '@/lib/affiliatePrograms'
import { isEbayEpnMobileApproved } from '@/lib/outboundLinks'
import { useThemeColors } from '@/theme'

export function AffiliateDisclosure() {
  const c = useThemeColors()
  const messages = [
    isEbayEpnMobileApproved ? 'We may earn a commission when you buy through eBay links.' : null,
    isMobileAmazonAffiliateEnabled ? 'As an Amazon Associate, CarPartsRadar earns from qualifying purchases.' : null,
  ].filter(Boolean)

  if (!hasMobileAffiliatePrograms) return null

  return (
    <View
      accessible
      accessibilityLabel={messages.join(' ')}
      style={{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: 10, padding: 10 }}
    >
      <Text style={{ color: c.subtext, fontSize: 12, lineHeight: 17 }}>{messages.join(' ')}</Text>
    </View>
  )
}
