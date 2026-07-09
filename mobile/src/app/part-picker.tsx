import { useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { partTypes } from '@/data/partTypes'
import { useThemeColors } from '@/theme'

export default function PartPicker() {
  const c = useThemeColors()
  const { year, make, model, trim } = useLocalSearchParams<{
    year: string
    make: string
    model: string
    trim?: string
  }>()
  const [q, setQ] = useState('')

  const goToResults = (part: string) =>
    router.push({ pathname: '/results', params: { year, make, model, trim: trim ?? '', part } })

  const shown = q
    ? partTypes.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    : partTypes.filter((p) => p.popular)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Text style={{ color: c.subtext, paddingHorizontal: 16, paddingTop: 12, fontWeight: '600' }}>
        {year} {String(make).toUpperCase()} {String(model).toUpperCase()}
      </Text>
      <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', padding: 16 }}>
        What part do you need?
      </Text>
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
        <Text
          style={{
            color: c.subtext,
            paddingHorizontal: 16,
            paddingBottom: 8,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 1,
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
