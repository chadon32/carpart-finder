import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import type { Listing } from '../api/types'
import { useThemeColors, brand, dataFont, dataFontBold } from '../theme'

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: 10, fontFamily: dataFont, letterSpacing: 0.5 }}>{label}</Text>
    </View>
  )
}

export function ListingCard({ listing, isBestValue, isCheapest, isComparing, onPress, onToggleCompare }: {
  listing: Listing
  isBestValue: boolean
  isCheapest: boolean
  isComparing: boolean
  onPress: () => void
  onToggleCompare: () => void
}) {
  const c = useThemeColors()
  const shipping =
    listing.shippingCost == null
      ? null
      : listing.shippingCost === 0
        ? 'Free shipping'
        : `+$${listing.shippingCost.toFixed(2)} shipping`

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        marginHorizontal: 16,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: c.border }}>
        {listing.image ? (
          <Image
            source={{ uri: listing.image }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : null}
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        <Text numberOfLines={2} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>
          {listing.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {isBestValue && <Pill label="BEST VALUE" bg={brand} fg="#fff" />}
          {isCheapest && <Pill label="CHEAPEST" bg="#d1fae5" fg="#047857" />}
          {listing.verifiedFitment && <Pill label="VERIFIED FITMENT" bg="#d1fae5" fg="#047857" />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ color: c.text, fontSize: 21, fontFamily: dataFontBold }}>
            ${listing.price.toFixed(2)}
          </Text>
          {listing.originalPrice ? (
            <Text style={{ color: c.subtext, textDecorationLine: 'line-through' }}>
              ${listing.originalPrice.toFixed(2)}
            </Text>
          ) : null}
          {shipping ? <Text style={{ color: c.subtext, fontSize: 13 }}>{shipping}</Text> : null}
        </View>
        <Text style={{ color: c.subtext, fontSize: 13 }}>
          {listing.condition} · {listing.seller}
          {listing.sellerFeedbackPercentage ? ` · ${listing.sellerFeedbackPercentage}%` : ''}
          {listing.sellerFeedbackScore != null ? ` (${listing.sellerFeedbackScore})` : ''}
        </Text>
        <Pressable
          onPress={onToggleCompare}
          style={{
            minHeight: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isComparing ? brand : c.border,
            backgroundColor: 'transparent',
          }}
        >
          <Text style={{ color: isComparing ? brand : c.subtext, fontWeight: '700' }}>
            {isComparing ? 'Remove from compare' : 'Compare'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  )
}
