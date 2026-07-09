import { View, Text, FlatList } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useGarage } from '@/stores/garage'
import { useThemeColors, displayFont } from '@/theme'
import { VehicleCard } from '@/components/VehicleCard'

export default function GarageScreen() {
  const c = useThemeColors()
  const vehicles = useGarage((s) => s.vehicles)
  const removeVehicle = useGarage((s) => s.removeVehicle)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <Text style={{ color: c.text, fontSize: 34, fontFamily: displayFont, padding: 16 }}>GARAGE</Text>
      <FlatList
        data={vehicles}
        keyExtractor={(v, i) => `${v.year}-${v.make}-${v.model}-${v.trim}-${i}`}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 24 }}
        renderItem={({ item, index }) => (
          <VehicleCard
            vehicle={item}
            onPress={() => router.push({ pathname: '/part-picker', params: { ...item } })}
            onRemove={() => removeVehicle(index)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 48, gap: 6 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>No vehicles yet</Text>
            <Text style={{ color: c.subtext, textAlign: 'center' }}>
              Add one from the Search tab — vehicles you pick are saved here.
            </Text>
          </View>
        }
        ListFooterComponent={
          vehicles.length > 0 ? (
            <Text style={{ color: c.subtext, fontSize: 12, textAlign: 'center', paddingTop: 16 }}>
              Settings arrive with accounts in a later release.
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
