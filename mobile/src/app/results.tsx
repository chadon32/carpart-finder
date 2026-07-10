import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, Pressable, RefreshControl, Animated } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { searchParts } from '@/api/client'
import type { Listing, SearchResponse } from '@/api/types'
import { deriveResultsState } from '@/lib/resultsState'
import { ListingCard } from '@/components/ListingCard'
import { useCompare } from '@/stores/compare'
import { useRecents } from '@/stores/recents'
import { useThemeColors, brand } from '@/theme'

function SkeletonCard() {
  const c = useThemeColors()
  const pulse = useRef(new Animated.Value(0.5)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return (
    <Animated.View
      style={{
        opacity: pulse,
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        marginHorizontal: 16,
        marginBottom: 12,
        height: 220,
      }}
    />
  )
}

const totalCost = (l: Listing) => l.price + (l.shippingCost ?? 0)

export default function Results() {
  const c = useThemeColors()
  const { year, make, model, trim, part } = useLocalSearchParams<{
    year: string
    make: string
    model: string
    trim?: string
    part: string
  }>()
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const compare = useCompare((s) => s.listings)
  const toggleCompare = useCompare((s) => s.toggle)
  const isComparing = useCompare((s) => s.isComparing)

  const run = useCallback(async () => {
    setFailed(false)
    try {
      const r = await searchParts(year, make, model, part, trim || undefined)
      setResponse(r)
      if (r.results.length > 0) {
        useRecents.getState().record({ year, make, model, trim: trim ?? '' }, part)
      }
    } catch {
      setFailed(true)
    }
  }, [year, make, model, part, trim])

  useEffect(() => {
    run()
  }, [run])

  const state = deriveResultsState(response, failed)
  const results = response?.results ?? []
  const cheapestId =
    results.length > 0
      ? results.reduce((min, l) => (totalCost(l) < totalCost(min) ? l : min), results[0]).id
      : null

  const openListing = (l: Listing) => {
    Haptics.selectionAsync()
    router.push({
      pathname: '/listing-detail',
      params: {
        listing: JSON.stringify(l),
        carLabel: `${year} ${make} ${model}`,
        part,
      },
    })
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Text style={{ color: c.subtext, paddingHorizontal: 16, paddingTop: 12, fontWeight: '600' }}>
        {part} · {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>

      {state === 'loading' && (
        <View style={{ paddingTop: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      )}

      {state === 'error' && (
        <View style={{ alignItems: 'center', paddingTop: 48, gap: 12, paddingHorizontal: 24 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
            Couldn't reach the search service
          </Text>
          <Text style={{ color: c.subtext, textAlign: 'center' }}>
            Check your connection and try again.
          </Text>
          <Pressable
            onPress={() => {
              setResponse(null)
              run()
            }}
            style={{
              backgroundColor: c.brand,
              borderRadius: 12,
              minHeight: 44,
              paddingHorizontal: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
          </Pressable>
        </View>
      )}

      {state === 'empty' && (
        <View style={{ alignItems: 'center', paddingTop: 48, gap: 6, paddingHorizontal: 24 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>No live listings found</Text>
          <Text style={{ color: c.subtext, textAlign: 'center' }}>
            Nothing matched this exact vehicle right now. Try a different part name.
          </Text>
        </View>
      )}

      {(state === 'live' || state === 'stale') && (
        <>
          {state === 'stale' && (
            <View
              style={{
                backgroundColor: '#fef3c7',
                marginHorizontal: 16,
                marginTop: 12,
                borderRadius: 12,
                padding: 10,
              }}
            >
              <Text style={{ color: '#92400e', fontWeight: '600', fontSize: 13 }}>
                Live search failed — showing recent results
              </Text>
            </View>
          )}
          <FlatList
            data={results}
            keyExtractor={(l) => l.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true)
                  await run()
                  setRefreshing(false)
                }}
              />
            }
            renderItem={({ item, index }) => (
              <ListingCard
                listing={item}
                isBestValue={index === 0}
                isCheapest={item.id === cheapestId}
                isComparing={isComparing(item.id)}
                onPress={() => openListing(item)}
                onToggleCompare={() => {
                  Haptics.selectionAsync()
                  toggleCompare(item)
                }}
              />
            )}
          />
        </>
      )}

      {compare.length > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            backgroundColor: '#0f172a',
            borderRadius: 16,
            padding: 14,
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text style={{ color: '#e2e8f0', fontWeight: '600', flex: 1 }}>
            {compare.length} selected
          </Text>
          <Pressable onPress={() => useCompare.getState().clear()} hitSlop={8}>
            <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Clear</Text>
          </Pressable>
          <Pressable
            disabled={compare.length < 2}
            onPress={() => router.push('/compare')}
            style={{
              backgroundColor: compare.length < 2 ? '#334155' : brand,
              borderRadius: 12,
              minHeight: 44,
              paddingHorizontal: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Compare</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
