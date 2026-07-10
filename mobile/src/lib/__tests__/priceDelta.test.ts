import { priceDelta } from '../priceDelta'

test('down, up, flat, unknown', () => {
  expect(priceDelta(20, 16.5)).toEqual({ text: '-$3.50', direction: 'down' })
  expect(priceDelta(20, 21)).toEqual({ text: '+$1.00', direction: 'up' })
  expect(priceDelta(20, 20)).toEqual({ text: '$0.00', direction: 'flat' })
  expect(priceDelta(20, null)).toEqual({ text: '—', direction: 'unknown' })
  expect(priceDelta(20, undefined)).toEqual({ text: '—', direction: 'unknown' })
})
