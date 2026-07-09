import { View, Text, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useGarage } from '@/stores/garage'
import { useThemeColors, brand, displayFont } from '@/theme'
import { VehicleCard } from '@/components/VehicleCard'

export default function SearchScreen() {
  const c = useThemeColors()
  const vehicles = useGarage((s) => s.vehicles)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ paddingTop: 8 }}>
          <Text style={{ color: c.text, fontSize: 38, fontFamily: displayFont, letterSpacing: 0.5 }}>
            CARPARTS<Text style={{ color: brand }}>RADAR</Text>
          </Text>
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
            <Text style={{ color: c.subtext, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
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
      </ScrollView>
    </SafeAreaView>
  )
}
