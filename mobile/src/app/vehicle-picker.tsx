import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { PickerList } from '@/components/PickerList'
import { fetchMakes, fetchModels, fetchTrims, decodeVinApi } from '@/api/client'
import { extractVin } from '@/lib/extractVin'
import { useGarage } from '@/stores/garage'
import { useThemeColors, dataFont } from '@/theme'

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
  const [vin, setVin] = useState('')
  const [vinBusy, setVinBusy] = useState(false)
  const [vinMsg, setVinMsg] = useState<string | null>(null)

  const decodeVin = async (value: string) => {
    setVinBusy(true)
    setVinMsg(null)
    try {
      const d = await decodeVinApi(value)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      const car = { year: d.year, make: d.make, model: d.model, trim: d.trim ?? '', vin: value }
      useGarage.getState().addVehicle(car)
      router.replace({
        pathname: '/part-picker',
        params: { year: car.year, make: car.make, model: car.model, trim: car.trim },
      })
    } catch (e) {
      setVinMsg(e instanceof Error ? e.message : 'VIN decode failed — check the VIN and try again.')
    } finally {
      setVinBusy(false)
    }
  }

  const scanVin = async () => {
    setVinMsg(null)
    // Lazy imports: these native modules only exist in builds that include
    // them — older installs get a message instead of a crash.
    let ImagePicker: typeof import('expo-image-picker')
    let TextRecognition: typeof import('@react-native-ml-kit/text-recognition').default
    try {
      ImagePicker = await import('expo-image-picker')
      TextRecognition = (await import('@react-native-ml-kit/text-recognition')).default
    } catch {
      setVinMsg('VIN scanning needs the newest app build — update from the install link.')
      return
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      setVinMsg('Camera access is off — enable it for CarPartsRadar in Settings.')
      return
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (shot.canceled || !shot.assets[0]?.uri) return
    setVinBusy(true)
    try {
      const result = await TextRecognition.recognize(shot.assets[0].uri)
      const found = extractVin(result.text)
      if (!found) {
        setVinMsg('No VIN found in the photo — try closer, straight-on.')
        setVinBusy(false)
        return
      }
      setVin(found)
      await decodeVin(found)
    } catch {
      setVinMsg('Could not read the photo — try again.')
      setVinBusy(false)
    }
  }

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
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 8 }}>
        <Text style={{ color: c.subtext, fontSize: 12, letterSpacing: 1, fontFamily: dataFont }}>
          HAVE YOUR VIN? (FASTEST)
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={vin}
            onChangeText={(t) => setVin(t.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17))}
            placeholder="17-character VIN"
            placeholderTextColor={c.subtext}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              flex: 1,
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
          <Pressable
            onPress={() => decodeVin(vin)}
            disabled={vin.length !== 17 || vinBusy}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: vin.length === 17 && !vinBusy ? c.brand : c.border,
            }}
          >
            {vinBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700' }}>Decode</Text>
            )}
          </Pressable>
          <Pressable
            onPress={scanVin}
            disabled={vinBusy}
            accessibilityLabel="Scan VIN with camera"
            style={{
              minHeight: 44,
              width: 48,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: c.brand,
              backgroundColor: c.card,
            }}
          >
            <Text style={{ fontSize: 18 }}>📷</Text>
          </Pressable>
        </View>
        {vinMsg ? <Text style={{ color: '#be123c', fontSize: 13 }}>{vinMsg}</Text> : null}
      </View>
      <PickerList key="year" title="Or pick the year" options={YEARS} onSelect={setYear} />
    </View>
  ) : !make ? (
    <PickerList
      key="make"
      title="Make"
      options={makes}
      loading={loading}
      searchable
      onSelect={setMake}
      onBack={() => setYear(null)}
      backLabel={`Year · ${year}`}
    />
  ) : !model ? (
    <PickerList
      key="model"
      title="Model"
      options={models}
      loading={loading}
      searchable
      onSelect={setModel}
      onBack={() => setMake(null)}
      backLabel={`Make · ${make}`}
    />
  ) : (
    <PickerList
      key="trim"
      title="Trim (optional)"
      options={['Skip', ...trims]}
      loading={loading}
      onSelect={(t) => finish(t === 'Skip' ? '' : t)}
      onBack={() => setModel(null)}
      backLabel={`Model · ${model}`}
    />
  )
}
