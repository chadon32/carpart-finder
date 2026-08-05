import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, Animated, Modal, Switch, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { searchParts, fetchPriceHistory, type PriceObservation } from '@/api/client'
import { companionsForPart } from '@/data/partTypes'
import { isElectricVehicle } from '@/data/electricVehicles'
import { retailerLinks } from '@/data/retailerLinks'
import { AffiliateDisclosure } from '@/components/AffiliateDisclosure'
import { hasMobileAffiliatePrograms } from '@/lib/affiliatePrograms'
import { openOutboundLink } from '@/lib/outboundLinks'
import { sparklineHeights } from '@/lib/sparkline'
import { usePrefs } from '@/stores/prefs'
import type { Listing, SearchResponse } from '@/api/types'
import { deriveResultsState, resultsErrorMessage } from '@/lib/resultsState'
import { presentListings } from '@/lib/resultsPresentation'
import {
  activeFilterCount,
  defaultFilters,
  valueScore,
  type ListingFilters,
} from '@/lib/listingFilters'
import { ListingCard } from '@/components/ListingCard'
import { useCompare } from '@/stores/compare'
import { useRecents } from '@/stores/recents'
import { RadarMark } from '@/components/RadarMark'
import { useThemeColors, brand, dataFont } from '@/theme'

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
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const compare = useCompare((s) => s.listings)
  const toggleCompare = useCompare((s) => s.toggle)
  const isComparing = useCompare((s) => s.isComparing)
  const [filters, setFilters] = useState<ListingFilters>(defaultFilters)
  const [sheetOpen, setSheetOpen] = useState(false)
  const zip = usePrefs((s) => s.zip)
  const prefsHydrated = usePrefs((s) => s.hydrated)
  // Draft ZIP edited in the sheet; committed to the store (triggering ONE
  // re-search) only when the sheet closes — never per keystroke.
  const [zipDraft, setZipDraft] = useState(zip)
  const [history, setHistory] = useState<PriceObservation[]>([])
  // Guards against out-of-order responses when searches overlap
  // (pull-to-refresh during a ZIP change): only the newest call may land.
  const runSeq = useRef(0)

  const run = useCallback(async () => {
    const seq = ++runSeq.current
    setFailed(false)
    setFailureMessage(null)
    try {
      const r = await searchParts(
        year, make, model, part, trim || undefined,
        usePrefs.getState().zip || undefined
      )
      if (seq !== runSeq.current) return
      setResponse(r)
      if (r.results.length > 0 || (r.fallbackResults?.length ?? 0) > 0) {
        useRecents.getState().record({ year, make, model, trim: trim ?? '' }, part)
      }
    } catch (error) {
      if (seq !== runSeq.current) return
      setFailureMessage(resultsErrorMessage(error))
      setFailed(true)
    }
  }, [year, make, model, part, trim])

  useEffect(() => {
    // Wait for prefs rehydration so a persisted ZIP doesn't cause a second
    // search right after the first.
    if (!prefsHydrated) return
    run()
  }, [run, zip, prefsHydrated])

  useEffect(() => {
    fetchPriceHistory(year, make, model, part)
      .then((r) => setHistory(r.observations))
      .catch(() => setHistory([]))
  }, [year, make, model, part])

  const companions = companionsForPart(part, isElectricVehicle(String(make), String(model)))

  const state = deriveResultsState(response, failed)
  const results = response?.results ?? []
  const fallbackResults = response?.fallbackResults ?? []
  const hiddenIrrelevantFallbacks = response?.fitmentSummary?.hiddenIrrelevantFallbacks ?? 0
  // Badges are computed from the complete verified set, then filters/sort can
  // reorder the display without changing which listing earned each badge.
  const bestValueId =
    results.length > 0
      ? results.reduce((best, listing) => (valueScore(listing) < valueScore(best) ? listing : best), results[0]).id
      : null
  const cheapestId =
    results.length > 0
      ? results.reduce((min, l) => (totalCost(l) < totalCost(min) ? l : min), results[0]).id
      : null
  const presentation = presentListings(results, fallbackResults, filters)
  const shown = presentation.verified
  const displayItems = presentation.items
  const filterCount = activeFilterCount(filters)

  const openListing = (l: Listing) => {
    Haptics.selectionAsync()
    router.push({
      pathname: '/listing-detail',
      params: {
        listing: JSON.stringify(l),
        carLabel: `${year} ${make} ${model}`,
        year,
        make,
        model,
        trim: trim ?? '',
        part,
      },
    })
  }

  // Placed mid-list (after the second card) so it's seen without scrolling
  // to the very end; falls back to the list footer on short result sets.
  const retailerBlock = (
    <View style={{ paddingHorizontal: 16, gap: 10, paddingVertical: 8 }}>
      <AffiliateDisclosure />
      <Text style={{ color: c.subtext, fontSize: 11, letterSpacing: 1, fontFamily: dataFont }}>
        COMPARE AT OTHER STORES
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Explicit height — without it this collapses to 0 inside a list
        // cell and the store row never appears.
        style={{ height: 44, flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, alignItems: 'center' }}
      >
        {retailerLinks.map((r) => (
          <Pressable
            key={r.name}
            accessibilityRole="link"
            onPress={() => openOutboundLink(r.buildUrl(`${year} ${make} ${model} ${part}`))}
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
            <Text style={{ color: c.text, fontWeight: '600' }}>{r.name} ↗</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
  const retailersInline = displayItems.length >= 3

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Text style={{ color: c.subtext, paddingHorizontal: 16, paddingTop: 12, fontWeight: '600' }}>
        {part} · {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>

      {state === 'loading' && (
        <View style={{ paddingTop: 12 }}>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 14 }}>
            <RadarMark size={44} color={c.brand} sweeping />
            <Text style={{ color: c.subtext, fontSize: 12, fontFamily: dataFont, letterSpacing: 1 }}>
              SCANNING LIVE LISTINGS
            </Text>
          </View>
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
            {failureMessage ?? 'Check your connection and try again.'}
          </Text>
          <Pressable
            accessibilityRole="button"
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
            No marketplace listings are available for this search right now. Try a different part name.
          </Text>
          {hiddenIrrelevantFallbacks > 0 ? (
            <Text style={{ color: c.subtext, textAlign: 'center', fontSize: 12, lineHeight: 17 }}>
              We excluded {hiddenIrrelevantFallbacks} accessory-only {hiddenIrrelevantFallbacks === 1 ? 'listing' : 'listings'} instead of showing them as matches for {part}.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{
                minHeight: 44,
                borderRadius: 12,
                paddingHorizontal: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.brand,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Choose another part</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setResponse(null)
                run()
              }}
              style={{
                minHeight: 44,
                borderRadius: 12,
                paddingHorizontal: 16,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.card,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Retry search</Text>
            </Pressable>
          </View>
        </View>
      )}

      {(state === 'live' || state === 'stale') && (
        <>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                // Re-sync the draft: a stacked results screen may have
                // committed a different ZIP since this screen mounted.
                setZipDraft(usePrefs.getState().zip)
                setSheetOpen(true)
              }}
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
          </View>
          {hasMobileAffiliatePrograms ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
              <AffiliateDisclosure />
            </View>
          ) : null}
          {companions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              // Explicit height: a horizontal ScrollView here can measure 0
              // while its children still paint over the list below.
              style={{ flexGrow: 0, height: 60 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center' }}
            >
              <Text style={{ color: c.subtext, fontSize: 11, letterSpacing: 1, fontFamily: dataFont }}>
                COMPLETE THE JOB
              </Text>
              {companions.map((name) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/results', params: { year, make, model, trim: trim ?? '', part: name } })
                  }
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.card,
                  }}
                >
                  <Text style={{ color: brand, fontWeight: '600' }}>+ {name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
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
            data={displayItems}
            keyExtractor={(item) => `${item.tier}-${item.listing.id}`}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 24, gap: 6 }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>No listings match your filters</Text>
                <Text style={{ color: c.subtext, textAlign: 'center' }}>
                  Loosen a filter or reset them to see all {results.length + fallbackResults.length} listings.
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
            ListFooterComponent={
              <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 8 }}>
                {history.length >= 5 && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: c.subtext, fontSize: 11, letterSpacing: 1, fontFamily: dataFont }}>
                      PRICE HISTORY ({history.length} DAYS)
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        gap: 2,
                        height: 40,
                        backgroundColor: c.card,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.border,
                        padding: 6,
                      }}
                    >
                      {sparklineHeights(history.map((o) => o.price)).map((h, i) => (
                        <View
                          key={i}
                          style={{
                            flex: 1,
                            height: Math.max(3, h * 28),
                            borderRadius: 2,
                            backgroundColor: brand,
                            opacity: 0.5 + h * 0.5,
                          }}
                        />
                      ))}
                    </View>
                    <Text style={{ color: c.subtext, fontSize: 11 }}>
                      ${Math.min(...history.map((o) => o.price)).toFixed(2)} low ·{' '}
                      ${Math.max(...history.map((o) => o.price)).toFixed(2)} high (daily observed lows)
                    </Text>
                  </View>
                )}
                {!retailersInline && retailerBlock}
              </View>
            }
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
              <>
                {item.tier === 'fallback' && index === shown.length ? (
                  <View
                    accessibilityRole="alert"
                    style={{
                      backgroundColor: '#fef3c7',
                      borderColor: '#f59e0b',
                      borderWidth: 1,
                      borderRadius: 14,
                      padding: 14,
                      marginHorizontal: 16,
                      marginBottom: 12,
                      gap: 4,
                    }}
                  >
                    <Text style={{ color: '#78350f', fontWeight: '800' }}>
                      {results.length === 0 ? 'No marketplace-confirmed matches' : 'Other marketplace keyword results'}
                    </Text>
                    <Text style={{ color: '#92400e', fontSize: 13, lineHeight: 18 }}>
                      Fitment was not confirmed for the listings below. Verify the part number, engine, drivetrain, and options before buying.
                    </Text>
                    {hiddenIrrelevantFallbacks > 0 ? (
                      <Text style={{ color: '#92400e', fontSize: 12, lineHeight: 17 }}>
                        We left out {hiddenIrrelevantFallbacks} accessory-only {hiddenIrrelevantFallbacks === 1 ? 'listing' : 'listings'} that did not clearly match {part}.
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <ListingCard
                  listing={item.listing}
                  isBestValue={item.tier === 'verified' && item.listing.id === bestValueId}
                  isCheapest={item.tier === 'verified' && item.listing.id === cheapestId}
                  isComparing={isComparing(item.listing.id)}
                  onPress={() => openListing(item.listing)}
                  onToggleCompare={() => {
                    Haptics.selectionAsync()
                    toggleCompare(item.listing)
                  }}
                />
                {retailersInline && index === 1 ? retailerBlock : null}
              </>
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
            <Pressable
              accessibilityRole="button"
              onPress={() => setFilters(defaultFilters)}
              hitSlop={8}
              style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
            >
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
              <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
                {label.toUpperCase()}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {options.map(([value, text]) => {
                  const active = filters[key] === value
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      key={String(value)}
                      onPress={() => setFilters((f) => ({ ...f, [key]: value }))}
                      style={{
                        minHeight: 44,
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

          <View style={{ gap: 8 }}>
            <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
              SHIPPING ZIP (EXACT SHIPPING COSTS)
            </Text>
            <TextInput
              value={zipDraft}
              onChangeText={(t) => setZipDraft(t.replace(/\D/g, '').slice(0, 5))}
              placeholder="e.g. 90210"
              placeholderTextColor={c.subtext}
              keyboardType="number-pad"
              maxLength={5}
              style={{
                minHeight: 44,
                borderRadius: 12,
                paddingHorizontal: 12,
                fontSize: 16,
                color: c.text,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
              }}
            />
          </View>

          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSheetOpen(false)
              // Committing the draft changes the store zip, which re-runs the
              // search once via the effect above.
              usePrefs.getState().setZip(zipDraft)
            }}
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
              Show {displayItems.length} listings
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
          <Pressable
            accessibilityRole="button"
            onPress={() => useCompare.getState().clear()}
            hitSlop={8}
            style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Clear</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
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
