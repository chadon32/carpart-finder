import {
  VISIT_EVENTS,
  VISIT_SESSION_IDLE_MS,
  VISIT_BATCH_LIMIT,
  isVisitId,
  visitProperties,
  visitSource,
} from '../../shared/visitAnalytics.mjs'

const STORAGE_KEY = 'cpf-analytics-session-v1'
type Session = { id: string; touched: number; source: string }
type VisitEvent = { id: string; name: string; properties: Record<string, string | boolean> }
let memorySession: Session | null = null
let queue: VisitEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let lastPage = ''
let listenersInstalled = false

export function analyticsAllowed() {
  return (
    typeof window !== 'undefined' &&
    !/^\/admin(?:\/|$)/.test(window.location.pathname) &&
    navigator.doNotTrack !== '1' &&
    !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl &&
    !navigator.webdriver
  )
}

function session(): Session {
  let value = memorySession
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    if (stored && typeof stored === 'object') {
      const candidate = stored as Session
      if (
        isVisitId(candidate.id) &&
        Number.isFinite(candidate.touched) &&
        ['direct', 'search', 'social', 'referral'].includes(candidate.source)
      )
        value = candidate
    }
  } catch {
    /* Private/storage-disabled browsers use an in-memory visit. */
  }
  const now = Date.now()
  if (!value || now - value.touched >= VISIT_SESSION_IDLE_MS || now < value.touched) {
    value = {
      id: crypto.randomUUID(),
      touched: now,
      source: visitSource(document.referrer, window.location.origin),
    }
  }
  value.touched = now
  memorySession = value
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* Optional storage. */
  }
  return value
}

function payload(events: VisitEvent[], current: Session) {
  return JSON.stringify({
    sessionId: current.id,
    source: current.source,
    device: window.innerWidth < 640 ? 'phone' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
    events,
  })
}

function flush(leaving = false) {
  if (timer) clearTimeout(timer)
  timer = null
  if (!queue.length || !analyticsAllowed() || !memorySession) {
    queue = []
    return
  }
  const body = payload(queue.splice(0, VISIT_BATCH_LIMIT), memorySession)
  if (leaving && navigator.sendBeacon) {
    try {
      if (
        navigator.sendBeacon(
          '/api/analytics/events',
          new Blob([body], { type: 'application/json' }),
        )
      )
        return
    } catch {
      /* Keepalive fetch below. */
    }
  }
  void fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    credentials: 'omit',
    keepalive: true,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    /* Tracking must never interrupt the website. */
  })
}

export function recordVisitEvent(name: string, properties: Record<string, unknown> = {}) {
  if (!analyticsAllowed() || !VISIT_EVENTS.includes(name)) return
  // Flush the old visit before replacing its idle-expired session identity.
  if (memorySession && Date.now() - memorySession.touched >= VISIT_SESSION_IDLE_MS) flush()
  session()
  queue.push({ id: crypto.randomUUID(), name, properties: visitProperties(name, properties) })
  if (!listenersInstalled) {
    listenersInstalled = true
    window.addEventListener('pagehide', () => flush(true))
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush(true)
    })
  }
  if (queue.length >= VISIT_BATCH_LIMIT) flush()
  else if (!timer) timer = setTimeout(() => flush(), 400)
}

export function recordPageView(page: string) {
  // React StrictMode can rerun mount effects. One screen entry is one view.
  if (!analyticsAllowed() || page === lastPage) return
  lastPage = page
  recordVisitEvent('Page Viewed', { page })
}
