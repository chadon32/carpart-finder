import { useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native'
import { useThemeColors, displayFont } from '../theme'

export function PickerList({ title, helperText, options, loading, onSelect, searchable = false, onBack, backLabel }: {
  title: string
  helperText?: string
  options: string[]
  loading?: boolean
  onSelect: (value: string) => void
  searchable?: boolean
  onBack?: () => void
  backLabel?: string
}) {
  const c = useThemeColors()
  const [q, setQ] = useState('')
  const shown = q ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase())) : options

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          hitSlop={8}
          style={{ paddingHorizontal: 16, paddingTop: 12, minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: c.brand, fontWeight: '600' }}>‹ {backLabel ?? 'Back'}</Text>
        </Pressable>
      ) : null}
      <Text style={{ color: c.text, fontSize: 26, fontFamily: displayFont, padding: 16 }}>
        {title.toUpperCase()}
      </Text>
      {helperText ? (
        <Text style={{ color: c.subtext, paddingHorizontal: 16, marginTop: -8, marginBottom: 12, fontSize: 13, lineHeight: 18 }}>
          {helperText}
        </Text>
      ) : null}
      {searchable ? (
        <TextInput
          accessibilityLabel={`Search ${title}`}
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor={c.subtext}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            marginHorizontal: 16,
            marginBottom: 8,
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
      ) : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect(item)}
              style={{
                minHeight: 48,
                justifyContent: 'center',
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              }}
            >
              <Text style={{ color: c.text, fontSize: 16 }}>{item}</Text>
            </Pressable>
          )}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  )
}
