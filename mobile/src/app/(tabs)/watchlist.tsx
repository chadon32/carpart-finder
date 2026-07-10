import { useCallback, useState } from 'react'
import { View, Text, FlatList, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useFocusEffect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import * as Haptics from 'expo-haptics'
import { fetchPricesChunked, type PriceInfo } from '@/api/client'
import { useWatchlist } from '@/stores/watchlist'
import { priceDelta } from '@/lib/priceDelta'
import { useThemeColors, displayFont, brand } from '@/theme'

const deltaColors: Record<string, string> = {
  down: '#047857',
  up: '#be123c',
  flat: '#64748b',
  unknown: '#64748b',
}

export default function WatchlistScreen() {
  const c = useThemeColors()
  const items = useWatchlist((s) => s.items)
  const unwatch = useWatchlist((s) => s.unwatch)
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({})

  useFocusEffect(
    useCallback(() => {
      if (items.length === 0) return
      fetchPricesChunked(items.map((i) => i.id))
        .then(setPrices)
        .catch(() => {})
    }, [items])
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <Text style={{ color: c.text, fontSize: 34, fontFamily: displayFont, padding: 16 }}>
        WATCHLIST
      </Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const current = prices[item.id]?.available ? prices[item.id]?.price : undefined
          const delta = priceDelta(item.priceAtAdd, current)
          return (
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border,
                padding: 12,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: c.border, overflow: 'hidden' }}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={2} style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: c.subtext, fontSize: 12 }}>
                    {item.part} · {item.carLabel}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
                      ${(current ?? item.priceAtAdd).toFixed(2)}
                    </Text>
                    {delta.direction === 'unknown' ? (
                      // Honesty: without a live quote the big number is the
                      // price when added — say so instead of implying live.
                      <Text style={{ color: c.subtext, fontSize: 13 }}>at add · no live quote</Text>
                    ) : (
                      <Text style={{ color: deltaColors[delta.direction], fontWeight: '700', fontSize: 13 }}>
                        {delta.direction === 'down' ? '↓ ' : delta.direction === 'up' ? '↑ ' : ''}
                        {delta.text}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => WebBrowser.openBrowserAsync(item.link)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: brand,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Buy on {item.source}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync()
                    unwatch(item.id)
                  }}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.card,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Remove</Text>
                </Pressable>
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 48, gap: 6 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Nothing watched yet</Text>
            <Text style={{ color: c.subtext, textAlign: 'center' }}>
              Tap Watch on any listing to track its price here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}
