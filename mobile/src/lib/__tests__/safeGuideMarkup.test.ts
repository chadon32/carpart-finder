import { parseGuideBlocks, parseInlineSegments } from '../safeGuideMarkup'

describe('safe guide markup', () => {
  it('recognizes only the small set of guide structures the app displays', () => {
    expect(parseGuideBlocks('# Safety\n- Disconnect power\n1. Remove cover\nPlain text')).toEqual([
      { type: 'heading', level: 1, text: 'Safety' },
      { type: 'bullet', text: 'Disconnect power' },
      { type: 'ordered', marker: '1.', text: 'Remove cover' },
      { type: 'paragraph', text: 'Plain text' },
    ])
  })

  it('keeps links as inert text instead of creating an actionable URL', () => {
    expect(parseGuideBlocks('[Open](https://malicious.example)')).toEqual([
      { type: 'paragraph', text: '[Open](https://malicious.example)' },
    ])
  })

  it('supports bold and inline-code emphasis without evaluating markup', () => {
    expect(parseInlineSegments('Use **eye protection** and `10 mm`.')).toEqual([
      { text: 'Use ' },
      { text: 'eye protection', emphasis: 'strong' },
      { text: ' and ' },
      { text: '10 mm', emphasis: 'code' },
      { text: '.' },
    ])
  })
})
