export const VISIT_EVENTS: readonly string[]
export const VISIT_PAGES: readonly string[]
export const VISIT_SOURCES: readonly string[]
export const VISIT_DEVICES: readonly string[]
export const VISIT_RETAILERS: readonly string[]
export const VISIT_SESSION_IDLE_MS: number
export const VISIT_BATCH_LIMIT: number
export function isVisitId(value: unknown): boolean
export function visitProperties(
  name: string,
  input?: Record<string, unknown>,
): Record<string, string | boolean>
export function validateVisitBatch(input: unknown): null | {
  sessionId: string
  device: string
  source: string
  events: { id: string; name: string; properties: Record<string, string | boolean> }[]
}
export function visitSource(referrer: string, currentOrigin: string): string
