import { VISIT_SESSION_IDLE_MS, isVisitId, visitSource } from '/analytics-contract.js'

// Small first-party page counter for static editorial pages. No third-party SDK.
if (navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl && !navigator.webdriver) {
  const storageKey = 'cpf-analytics-session-v1'
  const now = Date.now()
  let session = null
  try {
    session = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
  } catch {
    /* Storage is optional. */
  }
  if (
    !session ||
    !isVisitId(session.id) ||
    !Number.isFinite(session.touched) ||
    now < session.touched ||
    now - session.touched >= VISIT_SESSION_IDLE_MS ||
    !['direct', 'search', 'social', 'referral'].includes(session.source)
  ) {
    session = {
      id: crypto.randomUUID(),
      touched: now,
      source: visitSource(document.referrer, location.origin),
    }
  }
  session.touched = now
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(session))
  } catch {
    /* Never block reading. */
  }
  const path = location.pathname
  const known = ['about', 'methodology', 'contact', 'privacy', 'terms', 'affiliate-disclosure']
  const slug = path.replace(/^\//, '').replace(/\.html$/, '')
  const page =
    path === '/guides.html'
      ? 'guides'
      : /^\/guides\/[^/]+\.html$/.test(path)
        ? 'guide'
        : known.includes(slug)
          ? slug
          : 'other'
  const body = JSON.stringify({
    sessionId: session.id,
    source: session.source,
    device: innerWidth < 640 ? 'phone' : innerWidth < 1024 ? 'tablet' : 'desktop',
    events: [{ id: crypto.randomUUID(), name: 'Page Viewed', properties: { page } }],
  })
  void fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    credentials: 'omit',
    keepalive: true,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {})
}
