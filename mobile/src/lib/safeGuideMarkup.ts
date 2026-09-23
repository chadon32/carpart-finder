export type GuideBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'ordered'; marker: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'spacer' }

export type InlineSegment = {
  text: string
  emphasis?: 'strong' | 'code'
}

const MAX_GUIDE_LENGTH = 12_000

export function parseGuideBlocks(markup: string): GuideBlock[] {
  const safeMarkup = markup.slice(0, MAX_GUIDE_LENGTH).replace(/\r\n?/g, '\n')

  return safeMarkup.split('\n').map((rawLine) => {
    const line = rawLine.trim()
    if (!line) return { type: 'spacer' }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      return {
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2].trim(),
      }
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (bullet) return { type: 'bullet', text: bullet[1].trim() }

    const ordered = /^(\d{1,3}[.)])\s+(.+)$/.exec(line)
    if (ordered) {
      return { type: 'ordered', marker: ordered[1], text: ordered[2].trim() }
    }

    return { type: 'paragraph', text: line }
  })
}

export function parseInlineSegments(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let cursor = 0

  while (cursor < text.length) {
    const strongStart = text.indexOf('**', cursor)
    const codeStart = text.indexOf('`', cursor)
    const candidates = [strongStart, codeStart].filter((index) => index >= 0)

    if (candidates.length === 0) {
      segments.push({ text: text.slice(cursor) })
      break
    }

    const start = Math.min(...candidates)
    if (start > cursor) segments.push({ text: text.slice(cursor, start) })

    const marker = start === strongStart ? '**' : '`'
    const end = text.indexOf(marker, start + marker.length)
    if (end < 0) {
      segments.push({ text: text.slice(start) })
      break
    }

    const value = text.slice(start + marker.length, end)
    if (value) {
      segments.push({ text: value, emphasis: marker === '**' ? 'strong' : 'code' })
    }
    cursor = end + marker.length
  }

  return segments.length > 0 ? segments : [{ text: '' }]
}
