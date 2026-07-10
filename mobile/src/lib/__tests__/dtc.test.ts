import { lookupDtc } from '../../data/dtcCodes'

test('known code returns the catalog entry', () =>
  expect(lookupDtc('p0302')?.definition).toBe('Cylinder 2 Misfire Detected'))

test('unknown but valid P-code returns the generic fallback', () =>
  expect(lookupDtc('P0999')?.definition).toBe('OBD-II Diagnostic Code P0999'))

test('invalid shapes return null', () => {
  expect(lookupDtc('X123')).toBeNull()
  expect(lookupDtc('P12')).toBeNull()
  expect(lookupDtc('')).toBeNull()
})
