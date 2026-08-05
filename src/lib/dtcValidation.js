export const DTC_PATTERN = /^[P]\d{4}$/

export function classifyDtc(value, knownCodes) {
  const code = String(value ?? '').trim().toUpperCase()
  if (!code) return { code, status: 'empty' }
  if (!DTC_PATTERN.test(code)) return { code, status: 'invalid' }
  if (!Object.prototype.hasOwnProperty.call(knownCodes, code)) return { code, status: 'unknown' }
  return { code, status: 'recognized' }
}
