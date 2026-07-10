import { useEffect, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { router } from 'expo-router'
import { PickerList } from '@/components/PickerList'
import { fetchMakes, fetchModels, fetchTrims } from '@/api/client'
import { useGarage } from '@/stores/garage'
import { useThemeColors } from '@/theme'

const YEARS = Array.from({ length: 2027 - 1990 }, (_, i) => String(2026 - i))

export default function VehiclePicker() {
  const c = useThemeColors()
  const addVehicle = useGarage((s) => s.addVehicle)
  const [year, setYear] = useState<string | null>(null)
  const [make, setMake] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [makes, setMakes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [trims, setTrims] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // Bumping this re-runs whichever fetch effect is active — the retry button.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!year || make) return
    setLoading(true)
    setLoadError(false)
    fetchMakes()
      .then((r) => setMakes(r.makes))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [year, make, attempt])

  useEffect(() => {
    if (!year || !make || model) return
    setLoading(true)
    setLoadError(false)
    fetchModels(make, year)
      .then((r) => setModels(r.models))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [year, make, model, attempt])

  useEffect(() => {
    if (!year || !make || !model) return
    setLoading(true)
    setLoadError(false)
    fetchTrims(year, make, model)
      .then((r) => setTrims(r.trims))
      // Trims are optional enrichment — a failed trims fetch shouldn't block
      // the flow, so fall back to an empty list instead of an error screen.
      .catch(() => setTrims([]))
      .finally(() => setLoading(false))
  }, [year, make, model, attempt])

  const finish = (trim: string) => {
    const car = { year: year!, make: make!, model: model!, trim }
    addVehicle(car)
    router.replace({ pathname: '/part-picker', params: car })
  }

  if (loadError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: c.bg,
          alignItems: 'center',
          paddingTop: 48,
          gap: 12,
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
          Couldn't load vehicle data
        </Text>
        <Text style={{ color: c.subtext, textAlign: 'center' }}>
          Check your connection and try again.
        </Text>
        <Pressable
          onPress={() => setAttempt((a) => a + 1)}
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
    )
  }

  // Distinct keys force a remount per step — without them React reuses the
  // PickerList instance and the search text typed on one step (e.g. "toy"
  // to find TOYOTA) silently filters the next step's options to nothing.
  return !year ? (
    <PickerList key="year" title="Year" options={YEARS} onSelect={setYear} />
  ) : !make ? (
    <PickerList key="make" title="Make" options={makes} loading={loading} searchable onSelect={setMake} />
  ) : !model ? (
    <PickerList key="model" title="Model" options={models} loading={loading} searchable onSelect={setModel} />
  ) : (
    <PickerList
      key="trim"
      title="Trim (optional)"
      options={['Skip', ...trims]}
      loading={loading}
      onSelect={(t) => finish(t === 'Skip' ? '' : t)}
    />
  )
}
