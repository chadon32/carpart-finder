import { View, Text, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useGarage } from '@/stores/garage'
import { useRecents } from '@/stores/recents'
import { useThemeColors, brand, displayFont, dataFont } from '@/theme'
import { VehicleCard } from '@/components/VehicleCard'
import { RadarMark } from '@/components/RadarMark'

export default function SearchScreen() {
  const c = useThemeColors()
  const vehicles = useGarage((s) => s.vehicles)
  const recents = useRecents((s) => s.searches)
  const clearRecents = useRecents((s) => s.clear)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <RadarMark size={34} color={c.brand} sweeping />
            <Text style={{ color: c.text, fontSize: 38, fontFamily: displayFont, letterSpacing: 0.5 }}>
              CARPARTS<Text style={{ color: brand }}>RADAR</Text>
            </Text>
          </View>
          <Text style={{ color: c.subtext, marginTop: 4 }}>
            Live part prices, checked against your exact vehicle.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/vehicle-picker')}
          style={{
            backgroundColor: c.brand,
            borderRadius: 14,
            minHeight: 50,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Find parts for a vehicle</Text>
        </Pressable>

        {vehicles.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
              YOUR GARAGE
            </Text>
            {vehicles.slice(0, 3).map((v, i) => (
              <VehicleCard
                key={`${v.year}-${v.make}-${v.model}-${i}`}
                vehicle={v}
                onPress={() => router.push({ pathname: '/part-picker', params: { ...v } })}
              />
            ))}
          </View>
        )}

        {recents.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
                RECENT SEARCHES
              </Text>
              <Pressable onPress={clearRecents} hitSlop={8}>
                <Text style={{ color: c.subtext, fontSize: 12, fontWeight: '700' }}>Clear</Text>
              </Pressable>
            </View>
            {recents.slice(0, 4).map((r) => (
              <Pressable
                key={`${r.car.year}-${r.car.make}-${r.car.model}-${r.part}`}
                onPress={() =>
                  router.push({
                    pathname: '/results',
                    params: { ...r.car, part: r.part },
                  })
                }
                style={{
                  minHeight: 44,
                  justifyContent: 'center',
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>
                  {r.part}
                  <Text style={{ color: c.subtext, fontWeight: '400' }}>
                    {'  '}· {r.car.year} {r.car.make} {r.car.model}
                  </Text>
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
