import { View, Text, ScrollView, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { Stack, router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCompare } from '@/stores/compare'
import { useThemeColors, brand } from '@/theme'

export default function CompareScreen() {
  const c = useThemeColors()
  const listings = useCompare((s) => s.listings)
  const clear = useCompare((s) => s.clear)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen
        options={{
          title: 'Compare',
          headerRight: () => (
            <Pressable
              onPress={() => {
                clear()
                router.back()
              }}
              hitSlop={12}
            >
              <Text style={{ color: brand, fontWeight: '700' }}>Clear all</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView horizontal contentContainerStyle={{ padding: 16, gap: 12 }}>
        {listings.map((l) => {
          const shipping =
            l.shippingCost == null
              ? 'See listing'
              : l.shippingCost === 0
                ? 'Free'
                : `$${l.shippingCost.toFixed(2)}`
          return (
            <View
              key={l.id}
              style={{
                width: 200,
                backgroundColor: c.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border,
                overflow: 'hidden',
              }}
            >
              <View style={{ width: '100%', height: 120, backgroundColor: c.border }}>
                {l.image ? (
                  <Image source={{ uri: l.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : null}
              </View>
              <View style={{ padding: 12, gap: 8, flex: 1 }}>
                <Text numberOfLines={3} style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>
                  {l.title}
                </Text>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>
                  ${l.price.toFixed(2)}
                </Text>
                <Text style={{ color: c.subtext, fontSize: 12 }}>Shipping: {shipping}</Text>
                <Text style={{ color: c.subtext, fontSize: 12 }}>{l.condition}</Text>
                <Text style={{ color: c.subtext, fontSize: 12 }}>
                  {l.seller}
                  {l.sellerFeedbackPercentage ? ` · ${l.sellerFeedbackPercentage}%` : ''}
                </Text>
                {l.deliveryMin && l.deliveryMax ? (
                  <Text style={{ color: c.subtext, fontSize: 12 }}>
                    Arrives {l.deliveryMin} – {l.deliveryMax}
                  </Text>
                ) : null}
                {l.verifiedFitment ? (
                  <Text style={{ color: '#047857', fontSize: 12, fontWeight: '700' }}>
                    ✓ Verified fitment
                  </Text>
                ) : null}
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => WebBrowser.openBrowserAsync(l.link)}
                  style={{
                    minHeight: 44,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: brand,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Buy on {l.source}</Text>
                </Pressable>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}
