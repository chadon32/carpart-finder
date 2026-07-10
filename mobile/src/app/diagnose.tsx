import { useState } from 'react'
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { diagnoseProblem, fetchQuote, type DiagnosisMatch, type QuoteResponse } from '@/api/client'
import * as WebBrowser from 'expo-web-browser'
import { lookupDtc, type DtcEntry } from '@/data/dtcCodes'
import { useThemeColors, brand } from '@/theme'

const confidenceColors: Record<string, { bg: string; fg: string }> = {
  strong: { bg: '#d1fae5', fg: '#047857' },
  likely: { bg: '#e0e7ff', fg: '#3730a3' },
  possible: { bg: '#fef3c7', fg: '#92400e' },
}

export default function Diagnose() {
  const c = useThemeColors()
  const { mode, year, make, model, trim } = useLocalSearchParams<{
    mode: 'symptom' | 'obd'
    year: string
    make: string
    model: string
    trim?: string
  }>()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<DiagnosisMatch[] | null>(null)
  const [dtc, setDtc] = useState<DtcEntry | null>(null)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState(false)

  const pickedParts = Object.keys(picked).filter((k) => picked[k])

  // Changing the selection invalidates any fetched quote — its totals no
  // longer describe what's picked.
  const togglePick = (name: string) => {
    setPicked((p) => ({ ...p, [name]: !p[name] }))
    setQuote(null)
    setQuoteError(false)
  }

  const runQuote = async () => {
    setQuoting(true)
    setQuoteError(false)
    setQuote(null)
    try {
      const r = await fetchQuote(year, make, model, pickedParts, trim || undefined)
      setQuote(r)
    } catch {
      setQuoteError(true)
    } finally {
      setQuoting(false)
    }
  }

  const goToResults = (part: string) =>
    router.push({ pathname: '/results', params: { year, make, model, trim: trim ?? '', part } })

  const runSymptom = async () => {
    setBusy(true)
    setError(null)
    setMatches(null)
    try {
      const r = await diagnoseProblem(input.trim())
      setMatches(r.matches)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Diagnosis failed — try again.')
    } finally {
      setBusy(false)
    }
  }

  const runDtc = () => {
    setError(null)
    const entry = lookupDtc(input)
    if (!entry) {
      setDtc(null)
      setError('Invalid OBD-II code format (must match pattern like P0302).')
      return
    }
    setDtc(entry)
  }

  // Tap shops the part; long-press (or the +) adds it to the multi-part quote.
  const PartChip = ({ name, tag }: { name: string; tag?: string }) => {
    const selected = !!picked[name]
    return (
      <Pressable
        onPress={() => goToResults(name)}
        onLongPress={() => togglePick(name)}
        style={{
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: 12,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: selected ? brand : c.border,
          backgroundColor: selected ? '#e8eefb' : c.card,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text style={{ color: brand, fontWeight: '700' }}>
          {selected ? '✓ ' : ''}{name}
          {tag ? <Text style={{ color: c.subtext, fontWeight: '400' }}>  {tag}</Text> : null}
        </Text>
        <Pressable
          onPress={() => togglePick(name)}
          hitSlop={10}
          accessibilityLabel={selected ? `Remove ${name} from quote` : `Add ${name} to quote`}
        >
          <Text style={{ color: c.subtext, fontSize: 16, fontWeight: '700' }}>{selected ? '−' : '+'}</Text>
        </Pressable>
      </Pressable>
    )
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Text style={{ color: c.subtext, fontWeight: '600' }}>
        {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>

      {mode === 'symptom' ? (
        <>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>
            What's the car doing?
          </Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={'e.g. "Metallic grinding noise when I press the brake pedal"'}
            placeholderTextColor={c.subtext}
            multiline
            style={{
              minHeight: 90,
              borderRadius: 12,
              padding: 12,
              fontSize: 16,
              color: c.text,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              textAlignVertical: 'top',
            }}
          />
          <Pressable
            onPress={runSymptom}
            disabled={!input.trim() || busy}
            style={{
              backgroundColor: input.trim() && !busy ? brand : c.border,
              borderRadius: 14,
              minHeight: 50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Diagnose</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>
            Enter the OBD-II trouble code
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={input}
              onChangeText={(t) => setInput(t.toUpperCase())}
              placeholder="e.g. P0302"
              placeholderTextColor={c.subtext}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={5}
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
              onPress={runDtc}
              style={{
                minHeight: 44,
                paddingHorizontal: 18,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: brand,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Look up</Text>
            </Pressable>
          </View>
        </>
      )}

      {error ? <Text style={{ color: '#be123c', fontSize: 13 }}>{error}</Text> : null}

      {matches && matches.length === 0 && (
        <Text style={{ color: c.subtext }}>
          No confident matches for that description — try adding when it happens and what it sounds like.
        </Text>
      )}

      {matches?.map((m) => {
        const cc = confidenceColors[m.confidence]
        return (
          <View
            key={m.id}
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              padding: 14,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, flexShrink: 1 }}>{m.title}</Text>
              <View style={{ backgroundColor: cc.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: cc.fg, fontSize: 11, fontWeight: '800' }}>{m.confidence.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={{ color: c.subtext, fontSize: 12 }}>{m.system}</Text>
            <Text style={{ color: c.subtext, fontSize: 14, lineHeight: 20 }}>{m.summary}</Text>
            {m.safety ? (
              <Text style={{ color: '#be123c', fontSize: 13, fontWeight: '600' }}>⚠ {m.safety}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {m.parts.map((p) => (
                <PartChip key={p.name} name={p.name} tag={p.priority} />
              ))}
            </View>
          </View>
        )
      })}

      {pickedParts.length > 0 && (
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={runQuote}
            disabled={quoting}
            style={{
              backgroundColor: quoting ? c.border : brand,
              borderRadius: 14,
              minHeight: 50,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {quoting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                Get combined quote ({pickedParts.length})
              </Text>
            )}
          </Pressable>
          {quoteError && (
            <Text style={{ color: '#be123c', fontSize: 13 }}>
              Couldn't build the quote — try again.
            </Text>
          )}
          {quote && (
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border,
                padding: 14,
                gap: 10,
              }}
            >
              {quote.items.map((item) => (
                <View key={item.part} style={{ gap: 2 }}>
                  <Text style={{ color: c.subtext, fontSize: 12, fontWeight: '700' }}>{item.part}</Text>
                  {item.listing ? (
                    <Pressable
                      onPress={() => WebBrowser.openBrowserAsync(item.listing!.link)}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, minHeight: 44, alignItems: 'center' }}
                    >
                      <Text numberOfLines={1} style={{ color: c.text, flex: 1 }}>{item.listing.title}</Text>
                      <Text style={{ color: c.text, fontWeight: '800' }}>${item.listing.price.toFixed(2)}</Text>
                    </Pressable>
                  ) : (
                    <Text style={{ color: c.subtext, fontSize: 13 }}>No listing found for this part right now.</Text>
                  )}
                </View>
              ))}
              <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, gap: 2 }}>
                <Text style={{ color: c.subtext, fontSize: 13 }}>Subtotal ${quote.subtotal.toFixed(2)} · Shipping ${quote.shipping.toFixed(2)}</Text>
                <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>Total ${quote.total.toFixed(2)}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {dtc && (
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            padding: 14,
            gap: 8,
          }}
        >
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{dtc.definition}</Text>
          <Text style={{ color: c.subtext, fontSize: 14, lineHeight: 20 }}>{dtc.description}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {dtc.parts.map((p) => (
              <PartChip key={p} name={p} />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  )
}
