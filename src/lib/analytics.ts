import { guideSearchStart } from '../data/guideSearch'
import { sanitizeAnalyticsEvent } from '../../shared/analyticsPrivacy.mjs'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let posthogPromise: Promise<typeof import('posthog-js').default> | null = null
let initialized = false

function loadPosthog() {
  if (!POSTHOG_KEY) return null
  if (!posthogPromise) {
    // Analytics is optional and large. Load it only when a deployment has a
    // key, keeping the search experience out of the initial JavaScript path.
    posthogPromise = import('posthog-js').then((module) => module.default)
  }
  return posthogPromise
}

export function initAnalytics() {
  const pending = loadPosthog()
  if (!pending || initialized) return
  initialized = true
  void pending.then((posthog) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only',
      // Product events are explicitly emitted below. DOM autocapture could
      // collect free-text search, VIN, email, or retailer-link content.
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_persistence: true,
      cookieless_mode: 'always',
      property_denylist: [
        '$current_url',
        '$host',
        '$pathname',
        '$referrer',
        '$referring_domain',
        '$initial_referrer',
        '$initial_referring_domain',
      ],
      before_send: (event) => {
        if (!event) return null
        const sanitized = sanitizeAnalyticsEvent(event.event, event.properties)
        return sanitized ? { ...event, properties: sanitized.properties } : null
      },
    })
  }).catch(() => {
    // Analytics is optional; a blocked or failed chunk must never become a
    // console error that distracts from the product experience.
    initialized = false
  })
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  const sanitized = sanitizeAnalyticsEvent(eventName, properties)
  if (!sanitized) return
  const pending = loadPosthog()
  if (!pending) return
  void pending.then((posthog) => posthog.capture(sanitized.name, sanitized.properties)).catch(() => {
    // Keep tracking failures isolated from search, watchlist, and checkout UI.
  })
}

export function trackSearch(year: string, make: string, model: string, part: string) {
  trackEvent('Searched Part', {
    year,
    make,
    model,
    part,
    vehicleString: `${year} ${make} ${model}`,
  })
}

export function trackAIGenerated(part: string, vehicleLabel: string) {
  trackEvent('Generated AI Repair Guide', { part, vehicleLabel })
}

export function trackAddedToWatchlist(part: string, price: number, source: string) {
  trackEvent('Added to Watchlist', { part, price, source })
}

export function trackRetailerClick({
  retailer,
  placement,
  vehicleLabel,
  part,
  listingId,
  fitmentStatus,
}: {
  retailer: string
  placement: 'listing' | 'listing-detail' | 'store-comparison' | 'watchlist' | 'watchlist-compare'
  vehicleLabel: string
  part: string
  listingId?: string
  fitmentStatus?: 'verified' | 'unverified'
}) {
  // Keep this event free of URLs and user-entered email addresses. It is the
  // revenue-funnel event used to compare search, fitment, and retailer
  // conversion without sending unnecessary data to analytics.
  trackEvent('Retailer Clicked', {
    retailer,
    placement,
    vehicleString: vehicleLabel,
    part,
    ...(listingId ? { listingId } : {}),
    ...(fitmentStatus ? { fitmentStatus } : {}),
  })
}

export function trackComparisonChecklistShared({
  listingCount,
  structuredEvidenceCount,
  keywordMatchCount,
  knownTotalCount,
  retailerLinkCount,
}: {
  listingCount: number
  structuredEvidenceCount: number
  keywordMatchCount: number
  knownTotalCount: number
  retailerLinkCount: number
}) {
  trackEvent('comparison_checklist_shared', {
    listingCount,
    structuredEvidenceCount,
    keywordMatchCount,
    knownTotalCount,
    retailerLinkCount,
  })
}

export function trackGuideSearchStarted(guideId: string) {
  const start = guideSearchStart(guideId)
  if (!start) return
  trackEvent('guide_search_started', {
    guideId: start.id,
    partCategoryId: start.part,
  })
}

export function trackPartIdentificationDemo(action: 'viewed' | 'open_tool') {
  trackEvent('part_identification_demo', {
    demoId: 'parts-workbench-v1',
    action,
  })
}
