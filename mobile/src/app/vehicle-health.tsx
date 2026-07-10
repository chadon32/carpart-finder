import { useCallback, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { fetchRecalls, type Recall } from '@/api/client'
import { maintenanceForVehicle } from '@/data/maintenanceSchedule'
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
      setFailed(false)
      fetchRecalls(year, make, model)
        .then((r) => setRecalls(r.recalls))
        .catch(() => setFailed(true))
    }, [year, make, model, attempt])
  )

  const maintenance = maintenanceForVehicle(false)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Text style={{ color: c.subtext, fontWeight: '600' }}>
        {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>

      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>
        Safety recalls
        {recalls ? ` (${recalls.length})` : ''}
      </Text>

      {failed ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: c.subtext }}>
            Couldn't load recall data — this does NOT mean there are no recalls.
          </Text>
          <Pressable
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
        <ActivityIndicator style={{ marginVertical: 12 }} />
      ) : recalls.length === 0 ? (
        <Text style={{ color: '#047857', fontWeight: '600' }}>
          ✓ No open recalls found for this vehicle (NHTSA)
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
              <Text style={{ color: '#be123c', fontSize: 13 }}>Risk: {r.consequence}</Text>
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
