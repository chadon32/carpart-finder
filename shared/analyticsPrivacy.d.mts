export type SanitizedAnalyticsEvent = {
  name: string
  properties: Record<string, string | number | boolean>
}

export function sanitizeAnalyticsEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): SanitizedAnalyticsEvent | null
