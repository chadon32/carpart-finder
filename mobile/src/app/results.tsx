import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, Pressable, RefreshControl, Animated, Modal, Switch } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { searchParts } from '@/api/client'
import type { Listing, SearchResponse } from '@/api/types'
import { deriveResultsState } from '@/lib/resultsState'
import {
  applyListingFilters,
  activeFilterCount,
  defaultFilters,
  type ListingFilters,
} from '@/lib/listingFilters'
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
  const [filters, setFilters] = useState<ListingFilters>(defaultFilters)
  const [sheetOpen, setSheetOpen] = useState(false)

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
  // Badges are computed on the raw server ranking, then filters/sort reorder
  // the display — Best Value stays the server's pick wherever it lands.
  const bestValueId = results[0]?.id ?? null
  const cheapestId =
    results.length > 0
      ? results.reduce((min, l) => (totalCost(l) < totalCost(min) ? l : min), results[0]).id
      : null
  const shown = applyListingFilters(results, filters)
  const filterCount = activeFilterCount(filters)

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
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
            <Pressable
              onPress={() => setSheetOpen(true)}
              style={{
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderWidth: 1,
                borderColor: filterCount > 0 ? brand : c.border,
                backgroundColor: c.card,
              }}
            >
              <Text style={{ color: filterCount > 0 ? brand : c.text, fontWeight: '700' }}>
                Filters{filterCount > 0 ? ` (${filterCount})` : ''}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/repair-guide', params: { year, make, model, part } })}
              style={{
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: 12,
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.card,
              }}
            >
              <Text style={{ color: c.subtext, fontWeight: '700' }}>🔧 Repair guide</Text>
            </Pressable>
          </View>
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
            data={shown}
            keyExtractor={(l) => l.id}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 24, gap: 6 }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>No listings match your filters</Text>
                <Text style={{ color: c.subtext, textAlign: 'center' }}>
                  Loosen a filter or reset them to see all {results.length} listings.
                </Text>
              </View>
            }
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
            renderItem={({ item }) => (
              <ListingCard
                listing={item}
                isBestValue={item.id === bestValueId}
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

      <Modal
        visible={sheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: c.bg, padding: 20, gap: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>Filters</Text>
            <Pressable onPress={() => setFilters(defaultFilters)} hitSlop={8}>
              <Text style={{ color: brand, fontWeight: '700' }}>Reset</Text>
            </Pressable>
          </View>

          {(
            [
              ['Sort by', 'sort', [['best', 'Best value'], ['price', 'Price'], ['total', 'Price + shipping'], ['rating', 'Seller rating']]],
              ['Minimum seller rating', 'minRating', [[0, 'Any'], [90, '90%+'], [95, '95%+'], [98, '98%+']]],
              ['Condition', 'condition', [['all', 'All'], ['new', 'New'], ['used', 'Used']]],
            ] as const
          ).map(([label, key, options]) => (
            <View key={key} style={{ gap: 8 }}>
              <Text style={{ color: c.subtext, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
                {label.toUpperCase()}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {options.map(([value, text]) => {
                  const active = filters[key] === value
                  return (
                    <Pressable
                      key={String(value)}
                      onPress={() => setFilters((f) => ({ ...f, [key]: value }))}
                      style={{
                        minHeight: 40,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: active ? brand : c.border,
                        backgroundColor: active ? brand : c.card,
                      }}
                    >
                      <Text style={{ color: active ? '#fff' : c.text, fontWeight: '600' }}>{text}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ))}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>Hide overseas listings</Text>
            <Switch
              value={filters.hideOverseas}
              onValueChange={(v) => setFilters((f) => ({ ...f, hideOverseas: v }))}
              trackColor={{ true: brand }}
            />
          </View>

          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => setSheetOpen(false)}
            style={{
              backgroundColor: brand,
              borderRadius: 14,
              minHeight: 50,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              Show {applyListingFilters(results, filters).length} listings
            </Text>
          </Pressable>
        </View>
      </Modal>

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
