import { extractVin } from '../extractVin'

test('finds a clean VIN token', () =>
  expect(extractVin('VIN: 4T1BF1FK5FU123456 MADE IN JAPAN')).toBe('4T1BF1FK5FU123456'))

test('lowercase input is normalized', () =>
  expect(extractVin('4t1bf1fk5fu123456')).toBe('4T1BF1FK5FU123456'))

test('rejects tokens with I, O, or Q', () =>
  expect(extractVin('4T1BF1FK5FU12345O')).toBeNull())

test('finds VIN across a line break', () =>
  expect(extractVin('4T1BF1FK5\nFU123456')).toBe('4T1BF1FK5FU123456'))

test('returns null when nothing VIN-shaped', () =>
  expect(extractVin('TOYOTA CAMRY 2015')).toBeNull())
