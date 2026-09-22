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
export function clearLocalUserData({ preserveDevicePreferences = false } = {}) {
  let complete = true
  try {
    for (const key of Object.keys(localStorage)) {
      if (preserveDevicePreferences && key === 'cpf-dark-mode') continue
      if (isAppLocalKey(key)) localStorage.removeItem(key)
    }
  } catch {
    complete = false
  }

  try {
    for (const key of Object.keys(sessionStorage)) {
      if (isAppLocalKey(key)) sessionStorage.removeItem(key)
    }
  } catch {
    complete = false
  }

  return complete
}
