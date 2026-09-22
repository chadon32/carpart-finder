import { Text, View } from 'react-native'
import { parseGuideBlocks, parseInlineSegments } from '@/lib/safeGuideMarkup'
import { useThemeColors } from '@/theme'

function InlineText({ text }: { text: string }) {
  const c = useThemeColors()

  return (
    <Text>
      {parseInlineSegments(text).map((segment, index) => (
        <Text
          key={`${index}-${segment.text}`}
          style={
            segment.emphasis === 'strong'
              ? { fontWeight: '800' }
              : segment.emphasis === 'code'
                ? { backgroundColor: c.border, fontFamily: 'monospace' }
                : undefined
          }
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  )
}

export function SafeRepairGuide({ guide }: { guide: string }) {
  const c = useThemeColors()
  const blocks = parseGuideBlocks(guide)

  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === 'spacer') return <View key={index} style={{ height: 8 }} />

        if (block.type === 'heading') {
          const fontSize = block.level === 1 ? 24 : block.level === 2 ? 20 : 17
          return (
            <Text
              key={index}
              accessibilityRole="header"
              style={{ color: c.text, fontSize, lineHeight: fontSize + 6, fontWeight: '800', marginTop: 12 }}
            >
              <InlineText text={block.text} />
            </Text>
          )
        }

        if (block.type === 'bullet' || block.type === 'ordered') {
          const marker = block.type === 'bullet' ? '\u2022' : block.marker
          return (
            <View key={index} style={{ flexDirection: 'row', gap: 8, marginVertical: 3 }}>
              <Text style={{ color: c.text, width: 24, fontSize: 15, lineHeight: 22 }}>{marker}</Text>
              <Text style={{ color: c.text, flex: 1, fontSize: 15, lineHeight: 22 }}>
                <InlineText text={block.text} />
              </Text>
            </View>
          )
        }

        return (
          <Text key={index} style={{ color: c.text, fontSize: 15, lineHeight: 22, marginVertical: 3 }}>
            <InlineText text={block.text} />
          </Text>
        )
      })}
    </View>
  )
}
