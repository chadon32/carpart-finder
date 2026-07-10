// Honesty guardrail: no fetched price means no claim — '—', never a guess.
export function priceDelta(
  priceAtAdd: number,
  current: number | null | undefined
): { text: string; direction: 'down' | 'up' | 'flat' | 'unknown' } {
  if (current == null) return { text: '—', direction: 'unknown' }
  const diff = current - priceAtAdd
  if (diff === 0) return { text: '$0.00', direction: 'flat' }
  const sign = diff > 0 ? '+' : '-'
  return { text: `${sign}$${Math.abs(diff).toFixed(2)}`, direction: diff > 0 ? 'up' : 'down' }
}
