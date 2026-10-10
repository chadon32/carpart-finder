import { lazy, type ComponentType } from 'react'

// A lazily loaded screen is a separate file. Two things go wrong with it:
// the connection is gone, or a new release has replaced the file that an
// already-open tab still asks for. Browsers remember a failed module download
// for the life of the page and React.lazy remembers it too, so retrying in place
// cannot work and the page used to stay blank until the visitor reloaded by hand.
// A reload is the only reliable retry, and it is safe: the vehicle and part live
// in the address.

const RELOAD_KEY = 'cpr-stale-release-reload-at'
const RELOAD_COOLDOWN_MS = 60_000

export async function siteReachable(): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch('/favicon.svg', { cache: 'no-store', signal: controller.signal })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function reloadedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY))
    return Number.isFinite(at) && Date.now() - at < RELOAD_COOLDOWN_MS
  } catch {
    // Without storage there is no way to stop a reload loop, so never reload.
    return true
  }
}

async function loadWithRecovery<T>(factory: () => Promise<T>): Promise<T> {
  try {
    return await factory()
  } catch (error) {
    // The site answers but the file does not load: a newer release replaced
    // it, and one reload fetches the matching page. If the site cannot be
    // reached the visitor is offline, and reloading would only swap the app for
    // the browser's own error page, so show the in-app message instead.
    if (!reloadedRecently() && (await siteReachable())) {
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
      } catch {
        // Only the loop guard above depends on this.
      }
      window.location.reload()
      return new Promise<T>(() => {})
    }
    throw error
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same bound React.lazy uses
export function lazyWithRecovery<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() => loadWithRecovery(factory))
}
