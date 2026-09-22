import { useCallback, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking, Alert } from 'react-native'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { fetchRecalls, type Recall } from '@/api/client'
import { maintenanceForVehicle } from '@/data/maintenanceSchedule'
import { isElectricVehicle } from '@/data/electricVehicles'
import { useThemeColors, brand } from '@/theme'

export default function VehicleHealth() {
  const c = useThemeColors()
  const { year, make, model, trim } = useLocalSearchParams<{
    year: string
    make: string
    model: string
    trim?: string
  }>()
  const [recalls, setRecalls] = useState<Recall[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController()
      let cancelled = false
      setFailed(false)
      setRecalls(null)
      fetchRecalls(year, make, model, controller.signal)
        .then((r) => { if (!cancelled) setRecalls(r.recalls) })
        .catch(() => { if (!cancelled) setFailed(true) })
      return () => {
        cancelled = true
        controller.abort()
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- attempt is an explicit retry revision for the same vehicle.
    }, [year, make, model, attempt])
  )

  const maintenance = maintenanceForVehicle(isElectricVehicle(String(make), String(model)))

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ color: c.subtext, fontWeight: '600' }}>
        {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>

      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>
        Model recall notices
        {recalls ? ` (${recalls.length})` : ''}
      </Text>

      <Text style={{ color: c.subtext, fontSize: 13 }}>
        NHTSA notices for this year, make, and model — not your VIN's repair status.
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Check your VIN on NHTSA"
        accessibilityHint="Opens the NHTSA recall website in your browser"
        onPress={() => {
          void Linking.openURL('https://www.nhtsa.gov/recalls').catch(() => {
            Alert.alert('Could not open NHTSA', 'Open https://www.nhtsa.gov/recalls in your browser to check your VIN.')
          })
        }}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: c.brand, fontWeight: '700', textDecorationLine: 'underline' }}>Check your VIN on NHTSA</Text>
      </Pressable>

      {failed ? (
        <View accessibilityRole="alert" style={{ gap: 10 }}>
          <Text style={{ color: c.subtext }}>
            Couldn't load recall data — this does NOT mean there are no recalls.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((a) => a + 1)}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: brand,
              borderRadius: 12,
              minHeight: 44,
              paddingHorizontal: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
          </Pressable>
        </View>
      ) : recalls == null ? (
        <ActivityIndicator accessibilityLabel="Loading model recall notices" style={{ marginVertical: 12 }} />
      ) : recalls.length === 0 ? (
        <Text style={{ color: c.subtext }}>
          No recall notices were returned for this model. Check your VIN on NHTSA to confirm your vehicle's recall status.
        </Text>
      ) : (
        recalls.map((r, i) => (
          <View
            key={r.campaignNumber ?? i}
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#fca5a5',
              padding: 14,
              gap: 6,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '800' }}>{r.component ?? 'Recall'}</Text>
            {r.summary ? <Text style={{ color: c.subtext, fontSize: 14, lineHeight: 20 }}>{r.summary}</Text> : null}
            {r.consequence ? (
              <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>Risk: {r.consequence}</Text>
            ) : null}
            {r.remedy ? <Text style={{ color: c.subtext, fontSize: 13 }}>Remedy: {r.remedy}</Text> : null}
            {r.campaignNumber ? (
              <Text style={{ color: c.subtext, fontSize: 12 }}>Campaign {r.campaignNumber}</Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', marginTop: 8 }}>
        Typical maintenance
      </Text>
      <Text style={{ color: c.subtext, fontSize: 13 }}>
        Broad industry rules of thumb — not a vehicle-specific schedule. Your owner's manual is
        the source of truth.
      </Text>
      <Text style={{ color: c.subtext, fontSize: 13 }}>
        Engine-specific services are omitted because this vehicle's engine is not confirmed.
      </Text>
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          paddingHorizontal: 14,
        }}
      >
        {maintenance.map((m, i) => (
          <Pressable
            key={m.part}
            accessibilityRole="button"
            accessibilityLabel={`Shop ${m.part}`}
            accessibilityHint="Opens marketplace results for this general maintenance item"
            onPress={() =>
              router.push({ pathname: '/results', params: { year, make, model, trim: trim ?? '', part: m.part } })
            }
            style={{
              paddingVertical: 12,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              minHeight: 48,
            }}
          >
            <View style={{ flexShrink: 1 }}>
              <Text style={{ color: brand, fontWeight: '700' }}>{m.part}</Text>
              <Text style={{ color: c.subtext, fontSize: 12 }}>{m.note}</Text>
            </View>
            <Text style={{ color: c.subtext, fontSize: 13, fontWeight: '600' }}>
              ~{(m.intervalMiles / 1000).toFixed(0)}k mi
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}
