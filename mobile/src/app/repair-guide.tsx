import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import Markdown from 'react-native-markdown-display'
import { fetchRepairGuide } from '@/api/client'
import { useThemeColors, brand } from '@/theme'

export default function RepairGuide() {
  const c = useThemeColors()
  const { year, make, model, part } = useLocalSearchParams<{
    year: string
    make: string
    model: string
    part: string
  }>()
  const [guide, setGuide] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setFailed(false)
    setGuide(null)
    try {
      const r = await fetchRepairGuide(year, make, model, part, controller.signal)
      setGuide(r.guide)
    } catch (e) {
      // A deliberate dismissal is not a failure.
      if ((e as Error)?.name === 'AbortError') return
      setFailed(true)
    }
  }, [year, make, model, part])

  useEffect(() => {
    run()
    // Cancel the in-flight generation when the sheet is dismissed.
    return () => abortRef.current?.abort()
  }, [run])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ color: c.subtext, fontWeight: '600', marginBottom: 10 }}>
        {part} · {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>

      {failed ? (
        <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
          <Text style={{ color: c.text, fontWeight: '700' }}>Couldn't generate the guide</Text>
          <Pressable
            onPress={run}
            style={{
              backgroundColor: brand,
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
      ) : guide == null ? (
        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
          <ActivityIndicator size="large" />
          <Text style={{ color: c.subtext, textAlign: 'center' }}>
            Writing the {part} guide for your {year} {make} {model}…{'\n'}This takes 10–20 seconds.
          </Text>
        </View>
      ) : (
        <>
          <Markdown
            style={{
              body: { color: c.text, fontSize: 15, lineHeight: 22 },
              heading1: { color: c.text, fontWeight: '800', marginTop: 12 },
              heading2: { color: c.text, fontWeight: '800', marginTop: 12 },
              heading3: { color: c.text, fontWeight: '700', marginTop: 10 },
              bullet_list: { marginVertical: 6 },
              ordered_list: { marginVertical: 6 },
              code_inline: { backgroundColor: c.border, color: c.text },
              fence: { backgroundColor: c.card, borderColor: c.border },
              hr: { backgroundColor: c.border },
              strong: { color: c.text },
            }}
          >
            {guide}
          </Markdown>
          <Text style={{ color: c.subtext, fontSize: 12, marginTop: 20, fontStyle: 'italic' }}>
            AI-generated guidance — verify torque specs and procedures against your vehicle's
            service manual before starting work.
          </Text>
        </>
      )}
    </ScrollView>
  )
}
