import posthog from 'posthog-js'

// Try to grab keys from Vite env vars, but fail gracefully if they aren't there
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || ''
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export function initAnalytics() {
  if (POSTHOG_KEY) {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
      autocapture: true,
      capture_pageview: false, // We'll manage pageviews manually if we use a router, but Vite SPAs without react-router often just rely on autocapture or manual calls.
    })
  } else {
    console.log('[Analytics] PostHog disabled (no API key provided in .env)')
  }
}

export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (POSTHOG_KEY) {
    posthog.capture(eventName, properties)
  } else {
    console.log(`[Analytics] Track Event: ${eventName}`, properties)
  }
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
  trackEvent('Generated AI Repair Guide', {
    part,
    vehicleLabel,
  })
}

export function trackAddedToWatchlist(part: string, price: number, source: string) {
  trackEvent('Added to Watchlist', {
    part,
    price,
    source,
  })
}
