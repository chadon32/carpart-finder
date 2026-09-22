import { Alert, View, Text, ScrollView, Pressable, Share } from 'react-native'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useRef, useState } from 'react'
import type { Listing } from '@/api/types'
import { createSavedSearch, createPriceAlert } from '@/api/client'
import { fitmentPresentation } from '@/lib/fitmentPresentation'
import { openOutboundLink, prepareNonAffiliateShareUrl } from '@/lib/outboundLinks'
import { AffiliateDisclosure } from '@/components/AffiliateDisclosure'
import { hasMobileAffiliatePrograms } from '@/lib/affiliatePrograms'
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

type ListingRouteSearchParams = {
  listing?: string | string[]
  carLabel?: string | string[]
  year?: string | string[]
  make?: string | string[]
  model?: string | string[]
  trim?: string | string[]
  part?: string | string[]
}

type ListingRouteData = {
  listing: Listing
  carLabel: string
  year: string
  make: string
  model: string
  trim?: string
  part: string
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isOptionalFiniteNumber = (value: unknown) =>
  value == null || (typeof value === 'number' && Number.isFinite(value))

function isListing(value: unknown): value is Listing {
  if (!value || typeof value !== 'object') return false

  const listing = value as Record<string, unknown>
  return (
    ['id', 'title', 'currency', 'condition', 'seller', 'link', 'source'].every((key) =>
      isNonEmptyString(listing[key])
    ) &&
    typeof listing.price === 'number' &&
    Number.isFinite(listing.price) &&
    listing.price >= 0 &&
    typeof listing.crossBorder === 'boolean' &&
    (listing.image === null || typeof listing.image === 'string') &&
    (listing.sellerFeedbackPercentage === null || typeof listing.sellerFeedbackPercentage === 'string') &&
    isOptionalFiniteNumber(listing.shippingCost) &&
    isOptionalFiniteNumber(listing.originalPrice)
  )
}

function parseListingRouteData(params: ListingRouteSearchParams): ListingRouteData | null {
  const carLabel = isNonEmptyString(params.carLabel) ? params.carLabel : null
  const year = isNonEmptyString(params.year) ? params.year : null
  const make = isNonEmptyString(params.make) ? params.make : null
  const model = isNonEmptyString(params.model) ? params.model : null
  const part = isNonEmptyString(params.part) ? params.part : null

  if (!carLabel || !year || !make || !model || !part || typeof params.listing !== 'string') return null

  try {
    const listing: unknown = JSON.parse(params.listing)
    if (!isListing(listing)) return null

    return {
      listing,
      carLabel,
      year,
      make,
      model,
      trim: isNonEmptyString(params.trim) ? params.trim : undefined,
      part,
    }
  } catch {
    return null
  }
}

export default function ListingDetail() {
  const c = useThemeColors()
  const route = parseListingRouteData(useLocalSearchParams<ListingRouteSearchParams>())
  const watch = useWatchlist((s) => s.watch)
  const unwatch = useWatchlist((s) => s.unwatch)
  const watched = useWatchlist((s) => route != null && s.items.some((i) => i.id === route.listing.id))
  const signedIn = useAuth((s) => s.status === 'signedIn')
  const [alertState, setAlertState] = useState<'idle' | 'busy' | 'set' | 'failed'>('idle')
  const alertInFlight = useRef(false)

  if (!route) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <View accessibilityRole="alert" style={{ alignItems: 'center', gap: 6 }}>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 20 }}>Listing unavailable</Text>
          <Text style={{ color: c.subtext, textAlign: 'center', lineHeight: 20 }}>
            This listing link is incomplete or no longer available. Go back and choose another listing.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to listings"
          accessibilityHint="Returns to the previous screen"
          onPress={() => router.back()}
          style={{ backgroundColor: brand, borderRadius: 12, minHeight: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Back</Text>
        </Pressable>
      </View>
    )
  }

  const { listing, ...params } = route
  const fitment = fitmentPresentation(listing)
  const alertTarget = listing.shippingCost == null
    ? null
    : Number((listing.price + listing.shippingCost).toFixed(2))

  const createAlert = async () => {
    if (alertTarget == null || alertInFlight.current) return
    alertInFlight.current = true
    setAlertState('busy')
    try {
      const { search } = await createSavedSearch(
        params.year, params.make, params.model, params.trim ?? '', params.part
      )
      await createPriceAlert(search.id, alertTarget)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setAlertState('set')
    } catch {
      setAlertState('failed')
    } finally {
      alertInFlight.current = false
    }
  }

  const shipping =
    listing.shippingCost == null
      ? 'Unknown — see listing'
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

  const share = () => {
    const shareUrl = prepareNonAffiliateShareUrl(listing.link)
    if (!shareUrl) {
      Alert.alert('Unable to share link', 'This listing link is unavailable. Please try another listing.')
      return
    }
    return Share.share({
      message: `${listing.title} — $${listing.price.toFixed(2)}\n${shareUrl}`,
    })
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: hasMobileAffiliatePrograms ? 170 : 120 }}>
        <View style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: c.border }}>
          {listing.image ? (
            <Image source={{ uri: listing.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : null}
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{listing.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {listing.verifiedFitment ? (
              <Pill label="MARKETPLACE MATCH" bg="#d1fae5" fg="#047857" />
            ) : (
              <Pill label="FITMENT NOT VERIFIED" bg="#fef3c7" fg="#92400e" />
            )}
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

          {!listing.verifiedFitment ? (
            <View
              accessibilityRole="alert"
              style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, gap: 4 }}
            >
              <Text style={{ color: '#78350f', fontWeight: '800' }}>Confirm compatibility before buying</Text>
              <Text style={{ color: '#92400e', fontSize: 13, lineHeight: 18 }}>
                The marketplace did not confirm this listing for your vehicle. Check the original part number, engine, drivetrain, dimensions, and options on the seller page.
              </Text>
            </View>
          ) : null}

          <View
            accessible
            accessibilityLabel={`${fitment.title}. ${fitment.description}`}
            style={{
              backgroundColor: listing.verifiedFitment ? '#ecfdf5' : '#fffbeb',
              borderColor: listing.verifiedFitment ? '#a7f3d0' : '#fde68a',
              borderWidth: 1,
              borderRadius: 14,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: listing.verifiedFitment ? '#047857' : '#92400e', fontWeight: '800' }}>
              {fitment.title}
            </Text>
            <Text style={{ color: listing.verifiedFitment ? '#065f46' : '#92400e', fontSize: 13, lineHeight: 18 }}>
              {fitment.description}
            </Text>
            <View style={{ gap: 4 }}>
              <Text style={{ color: c.subtext, fontSize: 12 }}>Scope: {fitment.scope}</Text>
              <Text style={{ color: c.subtext, fontSize: 12 }}>Provider: {fitment.provider}</Text>
              {fitment.matchedVehicle ? (
                <Text style={{ color: c.subtext, fontSize: 12 }}>Matched fields: {fitment.matchedVehicle}</Text>
              ) : null}
              {fitment.checkedAt ? (
                <Text style={{ color: c.subtext, fontSize: 12 }}>Search checked by CarPartsRadar: {fitment.checkedAt}</Text>
              ) : null}
            </View>
            <View style={{ gap: 3 }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>Before you buy</Text>
              {fitment.checklist.map((item) => (
                <Text key={item} style={{ color: c.subtext, fontSize: 12, lineHeight: 17 }}>• {item}</Text>
              ))}
            </View>
          </View>

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

          {listing.verifiedFitment && listing.fitmentProof ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open repair guide"
              accessibilityHint="Shows compatibility and installation guidance for this listing"
              onPress={() =>
                router.push({
                  pathname: '/repair-guide',
                  params: {
                    year: params.year,
                    make: params.make,
                    model: params.model,
                    trim: params.trim ?? '',
                    part: params.part,
                    listingId: listing.id,
                    source: listing.source,
                    fitmentProof: listing.fitmentProof,
                  },
                })
              }
              style={{
                minHeight: 48,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.card,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Open repair guide</Text>
            </Pressable>
          ) : null}

          {signedIn && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={alertTarget == null
                ? 'Price alert unavailable because shipping cost is unknown'
                : `Email me if the known total for ${params.part} drops below $${alertTarget.toFixed(2)}`}
              accessibilityHint={alertState === 'failed' ? 'Tries to create the price alert again' : 'Creates a price alert using item price plus known shipping before tax'}
              accessibilityState={{ busy: alertState === 'busy', disabled: alertState === 'busy' || alertState === 'set' || alertTarget == null }}
              onPress={createAlert}
              disabled={alertState === 'busy' || alertState === 'set' || alertTarget == null}
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
                {alertTarget == null
                  ? 'Shipping cost unknown — alert unavailable'
                  : alertState === 'set'
                  ? `✓ Alert set — emails you below $${alertTarget.toFixed(2)} known total`
                  : alertState === 'busy'
                    ? 'Setting alert…'
                    : alertState === 'failed'
                      ? 'Alert failed — tap to retry'
                      : `🔔 Email me below $${alertTarget.toFixed(2)} known total`}
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
          paddingTop: hasMobileAffiliatePrograms ? 66 : 16,
          backgroundColor: c.bg,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}
      >
        {hasMobileAffiliatePrograms ? (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 88 }}>
            <AffiliateDisclosure />
          </View>
        ) : null}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Buy ${listing.title} on ${listing.source}`}
          accessibilityHint="Opens the seller listing in your browser"
          onPress={() => openOutboundLink(listing.link)}
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
          accessibilityRole="button"
          accessibilityLabel={watched ? `Remove ${listing.title} from your watchlist` : `Add ${listing.title} to your watchlist`}
          accessibilityHint="Tracks this listing in your watchlist"
          accessibilityState={{ selected: watched }}
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
          accessibilityRole="button"
          onPress={share}
          accessibilityLabel="Share listing"
          accessibilityHint="Opens sharing options for this listing"
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
