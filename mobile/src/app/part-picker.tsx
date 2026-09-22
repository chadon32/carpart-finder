import { useRef, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { identifyPartFromImage } from '@/api/client'
import { partTypesForVehicle } from '@/data/partTypes'
import { isElectricVehicle } from '@/data/electricVehicles'
import { isValidPartQuery, MAX_PART_QUERY_LENGTH, normalizePartQuery } from '@/lib/searchInput'
import { useThemeColors, displayFont, dataFont } from '@/theme'

export default function PartPicker() {
  const c = useThemeColors()
  const { year, make, model, trim } = useLocalSearchParams<{
    year: string
    make: string
    model: string
    trim?: string
  }>()
  const [q, setQ] = useState('')
  const [identifying, setIdentifying] = useState(false)
  const [identifyMsg, setIdentifyMsg] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const identificationInFlight = useRef(false)

  const goToResults = (part: string) => {
    if (identificationInFlight.current) return
    const normalizedPart = normalizePartQuery(part)
    if (!isValidPartQuery(normalizedPart)) return

    router.push({ pathname: '/results', params: { year, make, model, trim: trim ?? '', part: normalizedPart } })
  }
  const canSearch = isValidPartQuery(q)
  const submitSearch = () => goToResults(q)

  const identifyFromPhoto = async () => {
    if (identificationInFlight.current) return
    identificationInFlight.current = true
    setIdentifying(true)
    setIdentifyMsg(null)
    try {
      // Keep permission and camera failures in the same recovery path as
      // identification, and lock before importing to prevent rapid reentry.
      let ImagePicker: typeof import('expo-image-picker')
      try {
        ImagePicker = await import('expo-image-picker')
      } catch {
        setIdentifyMsg('Camera features need the newest app build — update from the install link.')
        return
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        setIdentifyMsg('Camera access is off — enable it for CarPartsRadar in Settings.')
        return
      }
      const shot = await ImagePicker.launchCameraAsync({ quality: 1 })
      if (shot.canceled || !shot.assets[0]?.uri) return
      // Downscale before upload: full-res phone photos exceed the API's 2 MB
      // body limit (the web client does the same at ~1024px). Lazy import —
      // the module is native and absent from older builds.
      let base64: string
      try {
        const ImageManipulator = await import('expo-image-manipulator')
        const small = await ImageManipulator.manipulateAsync(
          shot.assets[0].uri,
          [{ resize: { width: 1024 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7, base64: true }
        )
        if (!small.base64) throw new Error('no base64')
        base64 = small.base64
      } catch {
        setIdentifyMsg('Photo identification needs the newest app build — update from the install link.')
        return
      }
      // The API validates a Data URL shape, not raw base64.
      const r = await identifyPartFromImage(`data:image/jpeg;base64,${base64}`)
      if (r.identified && r.partName) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        const suggestion = normalizePartQuery(r.partName)
        setQ(suggestion)
        setAiSuggestion(suggestion)
      } else {
        setIdentifyMsg("Couldn't identify the part — try a clearer photo or search by name.")
      }
    } catch {
      setIdentifyMsg('Photo identification failed — check camera access and your connection, then try again or search by name.')
    } finally {
      identificationInFlight.current = false
      setIdentifying(false)
    }
  }

  const electric = isElectricVehicle(String(make), String(model))
  const available = partTypesForVehicle(electric)
  const shown = q
    ? available.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    : available.filter((p) => p.popular)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Text style={{ color: c.subtext, paddingHorizontal: 16, paddingTop: 12, fontWeight: '600' }}>
        {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>
      <Text style={{ color: c.text, fontSize: 26, fontFamily: displayFont, padding: 16 }}>
        WHAT PART DO YOU NEED?
      </Text>
      {electric && (
        <Text style={{ color: c.brand, paddingHorizontal: 16, paddingBottom: 8, fontSize: 13, fontWeight: '600' }}>
          ⚡ Electric vehicle detected — engine-only parts are hidden.
        </Text>
      )}
      <TextInput
        value={q}
        onChangeText={(value) => {
          setQ(value)
          setAiSuggestion(null)
        }}
        onSubmitEditing={submitSearch}
        placeholder="Part name or OEM number (e.g. Brake Rotors)"
        placeholderTextColor={c.subtext}
        returnKeyType="search"
        autoCorrect={false}
        maxLength={MAX_PART_QUERY_LENGTH}
        accessibilityLabel="Search by part name or original equipment number"
        accessibilityHint="Enter a part name or original equipment number to search"
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
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
      {aiSuggestion ? (
        <Text accessibilityRole="alert" style={{ color: c.brand, paddingHorizontal: 16, marginTop: -6, marginBottom: 12, fontSize: 12, lineHeight: 18 }}>
          AI suggestion: {aiSuggestion}. Review or edit it, then search to confirm.
        </Text>
      ) : (
        <Text style={{ color: c.subtext, paddingHorizontal: 16, marginTop: -6, marginBottom: 12, fontSize: 12 }}>
          Enter a part name or original equipment number. {q.length}/{MAX_PART_QUERY_LENGTH}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search listings"
        accessibilityHint="Searches listings for the entered part"
        accessibilityState={{ disabled: !canSearch || identifying }}
        disabled={!canSearch || identifying}
        onPress={submitSearch}
        style={{
          minHeight: 44,
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: canSearch && !identifying ? c.brand : c.border,
        }}
      >
        <Text style={{ color: canSearch && !identifying ? '#fff' : c.subtext, fontWeight: '700' }}>
          Search listings
        </Text>
      </Pressable>
      {!q && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get an AI part suggestion from a photo"
            accessibilityHint="Opens the camera. Review or edit the AI suggestion before searching"
            accessibilityState={{ busy: identifying, disabled: identifying }}
            onPress={identifyFromPhoto}
            disabled={identifying}
            style={{
              minHeight: 50,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: c.brand,
              backgroundColor: c.card,
            }}
          >
            {identifying ? (
              <>
                <ActivityIndicator />
                <Text style={{ color: c.subtext, fontWeight: '700' }}>Identifying part…</Text>
              </>
            ) : (
              <Text style={{ color: c.brand, fontWeight: '700' }}>📷  Identify from a photo</Text>
            )}
          </Pressable>
          {identifyMsg ? (
            <Text accessibilityRole="alert" style={{ color: '#be123c', fontSize: 13 }}>{identifyMsg}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Describe the problem"
              accessibilityHint="Opens symptom-based diagnosis"
              onPress={() =>
                router.push({ pathname: '/diagnose', params: { mode: 'symptom', year, make, model, trim: trim ?? '' } })
              }
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.card,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Describe the problem</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter an OBD-II code"
              accessibilityHint="Opens trouble-code diagnosis"
              onPress={() =>
                router.push({ pathname: '/diagnose', params: { mode: 'obd', year, make, model, trim: trim ?? '' } })
              }
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.card,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>OBD-II code</Text>
            </Pressable>
          </View>
        </View>
      )}
      {!q && (
        <Text
          style={{
            color: c.subtext,
            paddingHorizontal: 16,
            paddingBottom: 8,
            fontSize: 12,
            letterSpacing: 1,
            fontFamily: dataFont,
          }}
        >
          POPULAR
        </Text>
      )}
      <FlatList
        data={shown}
        numColumns={2}
        keyExtractor={(p) => p.name}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Search for ${item.name}`}
            accessibilityHint="Shows listings for this part"
            onPress={() => goToResults(item.name)}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 12,
              justifyContent: 'center',
              paddingHorizontal: 12,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '600' }}>{item.name}</Text>
          </Pressable>
        )}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  )
}
