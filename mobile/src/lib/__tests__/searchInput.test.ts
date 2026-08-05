import { isValidPartQuery, MAX_PART_QUERY_LENGTH, normalizePartQuery } from '../searchInput'

test('normalizes pasted whitespace before a part search', () => {
  expect(normalizePartQuery('  Brake\n\tPads  ')).toBe('Brake Pads')
})

test('accepts a useful part or OE-number query within the API limit', () => {
  expect(isValidPartQuery('Brake Pads')).toBe(true)
  expect(isValidPartQuery('04465-0K010')).toBe(true)
})

test('rejects empty and overlong searches before navigation', () => {
  expect(isValidPartQuery('   ')).toBe(false)
  expect(isValidPartQuery('x'.repeat(MAX_PART_QUERY_LENGTH + 1))).toBe(false)
})
