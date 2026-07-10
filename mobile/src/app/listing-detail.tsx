import { View, Text, ScrollView, Pressable, Share } from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Haptics from 'expo-haptics'
import { useState } from 'react'
import type { Listing } from '@/api/types'
import { createSavedSearch, createPriceAlert } from '@/api/client'
import { useWatchlist } from '@/stores/watchlist'
import { useAuth } from '@/stores/auth'
import { useThemeColors, brand } from '@/theme'

function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const c = useThemeColors()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6 }}>
      <Text style={{ color: c.subtext, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  )
}

export default function ListingDetail() {
  const c = useThemeColors()
  const params = useLocalSearchParams<{
    listing: string
    carLabel: string
    year: string
    make: string
    model: string
    trim?: string
    part: string
  }>()
  const listing = JSON.parse(params.listing) as Listing
  const watch = useWatchlist((s) => s.watch)
  const unwatch = useWatchlist((s) => s.unwatch)
  const watched = useWatchlist((s) => s.items.some((i) => i.id === listing.id))
  const signedIn = useAuth((s) => s.status === 'signedIn')
  const [alertState, setAlertState] = useState<'idle' | 'busy' | 'set' | 'failed'>('idle')

  const createAlert = async () => {
    setAlertState('busy')
    try {
      const { search } = await createSavedSearch(
        params.year, params.make, params.model, params.trim ?? '', params.part
      )
      await createPriceAlert(search.id, listing.price)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setAlertState('set')
    } catch {
      setAlertState('failed')
    }
  }

  const shipping =
    listing.shippingCost == null
      ? 'See listing'
      : listing.shippingCost === 0
        ? 'Free'
        : `$${listing.shippingCost.toFixed(2)}`
  const delivery =
    listing.deliveryMin && listing.deliveryMax
      ? `${listing.deliveryMin} – ${listing.deliveryMax}`
      : (listing.estimatedDelivery ?? 'See listing')

  const toggleWatch = () => {
    if (watched) {
      Haptics.selectionAsync()
      unwatch(listing.id)
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      watch(listing, params.carLabel, params.part)
    }
  }

  const share = () =>
    Share.share({
      message: `${listing.title} — $${listing.price.toFixed(2)}\n${listing.link}`,
    })

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: c.border }}>
          {listing.image ? (
            <Image source={{ uri: listing.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : null}
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{listing.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {listing.verifiedFitment && <Pill label="VERIFIED FITMENT" bg="#d1fae5" fg="#047857" />}
            {listing.topRatedSeller && <Pill label="TOP RATED" bg="#e0e7ff" fg="#3730a3" />}
            {listing.discountPercentage && (
              <Pill label={`${listing.discountPercentage}% OFF`} bg="#ffe4e6" fg="#be123c" />
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ color: c.text, fontSize: 30, fontWeight: '800' }}>
              ${listing.price.toFixed(2)}
            </Text>
            {listing.originalPrice ? (
              <Text style={{ color: c.subtext, fontSize: 16, textDecorationLine: 'line-through' }}>
                ${listing.originalPrice.toFixed(2)}
              </Text>
            ) : null}
          </View>
          <Text style={{ color: c.subtext, fontSize: 13 }}>
            For {params.part} · {params.carLabel}
          </Text>

          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Row label="Condition" value={listing.condition} />
            <Row label="Shipping" value={shipping} />
            <Row label="Delivery" value={delivery} />
            <Row
              label="Seller"
              value={`${listing.seller}${listing.sellerFeedbackPercentage ? ` · ${listing.sellerFeedbackPercentage}%` : ''}${listing.sellerFeedbackScore != null ? ` (${listing.sellerFeedbackScore})` : ''}`}
            />
            {listing.itemLocation ? <Row label="Ships from" value={listing.itemLocation} /> : null}
            <Row label="Source" value={listing.source} />
          </View>

          {listing.shortDescription ? (
            <Text style={{ color: c.subtext, fontSize: 14, lineHeight: 20 }}>
              {listing.shortDescription}
            </Text>
          ) : null}

          {signedIn && (
            <Pressable
              onPress={createAlert}
              disabled={alertState === 'busy' || alertState === 'set'}
              style={{
                minHeight: 48,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: alertState === 'set' ? '#047857' : c.border,
                backgroundColor: alertState === 'set' ? '#d1fae5' : c.card,
              }}
            >
              <Text style={{ color: alertState === 'set' ? '#047857' : c.text, fontWeight: '700' }}>
                {alertState === 'set'
                  ? `✓ Alert set — emails you below $${listing.price.toFixed(2)}`
                  : alertState === 'busy'
                    ? 'Setting alert…'
                    : alertState === 'failed'
                      ? 'Alert failed — tap to retry'
                      : `🔔 Email me if ${params.part} drops below $${listing.price.toFixed(2)}`}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          gap: 10,
          padding: 16,
          paddingBottom: 28,
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}
      >
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(listing.link)}
          style={{
            flex: 2,
            backgroundColor: brand,
            borderRadius: 14,
            minHeight: 50,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            Buy on {listing.source}
          </Text>
        </Pressable>
        <Pressable
          onPress={toggleWatch}
          style={{
            flex: 1,
            borderRadius: 14,
            minHeight: 50,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: watched ? '#047857' : c.border,
            backgroundColor: watched ? '#d1fae5' : c.card,
          }}
        >
          <Text style={{ color: watched ? '#047857' : c.text, fontWeight: '700' }}>
            {watched ? 'Watching' : 'Watch'}
          </Text>
        </Pressable>
        <Pressable
          onPress={share}
          accessibilityLabel="Share listing"
          style={{
            width: 50,
            borderRadius: 14,
            minHeight: 50,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
          }}
        >
          <Text style={{ color: c.text, fontSize: 18 }}>⇪</Text>
        </Pressable>
      </View>
    </View>
  )
}
