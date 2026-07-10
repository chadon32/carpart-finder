import { useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { identifyPartFromImage } from '@/api/client'
import { partTypesForVehicle } from '@/data/partTypes'
import { isElectricVehicle } from '@/data/electricVehicles'
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

  const goToResults = (part: string) =>
    router.push({ pathname: '/results', params: { year, make, model, trim: trim ?? '', part } })

  const identifyFromPhoto = async () => {
    setIdentifyMsg(null)
    // Lazy import: the native module only exists in builds that include it —
    // older installs get a message instead of a crash at module load.
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
    setIdentifying(true)
    try {
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
        setIdentifying(false)
        return
      }
      // The API validates a Data URL shape, not raw base64.
      const r = await identifyPartFromImage(`data:image/jpeg;base64,${base64}`)
      if (r.identified && r.partName) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        goToResults(r.partName)
      } else {
        setIdentifyMsg("Couldn't identify the part — try a clearer photo or search by name.")
      }
    } catch {
      setIdentifyMsg('Identification failed — check your connection and try again.')
    } finally {
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
        onChangeText={setQ}
        onSubmitEditing={() => q.trim() && goToResults(q.trim())}
        placeholder="Search any part (e.g. Brake Rotors)"
        placeholderTextColor={c.subtext}
        returnKeyType="search"
        autoCorrect={false}
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
      {!q && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
          <Pressable
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
            <Text style={{ color: '#be123c', fontSize: 13 }}>{identifyMsg}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
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
