import { Pressable, Text, View } from 'react-native'
import { useThemeColors } from '../theme'

type SettingsRowProps = {
  title: string
  detail?: string
  destructive?: boolean
  onPress: () => void
}
export function SettingsRow({ title, detail, destructive = false, onPress }: SettingsRowProps) {
  const c = useThemeColors()
  const color = destructive ? '#be123c' : c.text

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 58,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pressed ? c.border : c.card,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {detail ? <Text style={{ color: c.subtext, fontSize: 13 }}>{detail}</Text> : null}
      </View>
      <Text style={{ color: c.subtext, fontSize: 28, lineHeight: 28 }}>›</Text>
    </Pressable>
  )
}
