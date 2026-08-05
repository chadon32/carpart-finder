const LOCAL_KEYS = new Set([
  'carpartsradar-user',
  'carpartsradar-garage',
  'car-part-finder-recent',
  'cpf-dark-mode',
])

export function isAppLocalKey(key) {
  return (
    LOCAL_KEYS.has(key) ||
    key.startsWith('cpf-') ||
    key.startsWith('carpartsradar-') ||
    key.startsWith('car-part-finder-')
  )
}

// Remove data owned by this app after a permanent account deletion. Storage
// can be blocked or full, so cleanup is best-effort and never masks a server
// deletion that already succeeded.
export function clearLocalUserData() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (isAppLocalKey(key)) localStorage.removeItem(key)
    }
  } catch {
    // The server-side deletion remains authoritative if browser storage fails.
  }

  try {
    for (const key of Object.keys(sessionStorage)) {
      if (isAppLocalKey(key)) sessionStorage.removeItem(key)
    }
  } catch {
    // Session caches are optional and may be unavailable in private browsing.
  }
}
