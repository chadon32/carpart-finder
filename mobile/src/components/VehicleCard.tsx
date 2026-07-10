import { useEffect, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { SymbolView } from 'expo-symbols'
import type { GarageVehicle } from '../api/types'
import { fetchVehicleImage } from '../api/client'
import { useThemeColors } from '../theme'

export function VehicleCard({ vehicle, onPress, onRemove, onHealth }: {
  vehicle: GarageVehicle
  onPress: () => void
  onRemove?: () => void
  onHealth?: () => void
}) {
  const c = useThemeColors()
  const [img, setImg] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetchVehicleImage(vehicle.make, vehicle.model, vehicle.year)
      .then((r) => {
        if (live) setImg(r.imageUrl)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [vehicle.make, vehicle.model, vehicle.year])

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        backgroundColor: c.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        minHeight: 64,
      }}
    >
      {img ? (
        <Image source={{ uri: img }} style={{ width: 72, height: 48, borderRadius: 8 }} contentFit="cover" />
      ) : (
        <View
          style={{
            width: 72,
            height: 48,
            borderRadius: 8,
            backgroundColor: c.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SymbolView name="car.side" size={22} tintColor={c.subtext} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '700' }}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        {vehicle.trim ? <Text style={{ color: c.subtext, fontSize: 13 }}>{vehicle.trim}</Text> : null}
      </View>
      {onHealth ? (
        <Pressable onPress={onHealth} hitSlop={12} accessibilityLabel="Vehicle health and recalls">
          <SymbolView name="heart.text.square" size={20} tintColor={c.subtext} />
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={12} accessibilityLabel="Remove vehicle">
          <SymbolView name="trash" size={20} tintColor={c.subtext} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}
