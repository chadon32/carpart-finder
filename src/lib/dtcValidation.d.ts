export const DTC_PATTERN: RegExp
export type DtcStatus = 'empty' | 'invalid' | 'unknown' | 'recognized'
export function classifyDtc(value: unknown, knownCodes: Record<string, unknown>): { code: string; status: DtcStatus }
