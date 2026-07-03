import { useEffect, useState } from 'react'

// Like useState, but persisted to localStorage under `key` so the value
// survives navigation and page reloads.
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw !== null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore storage errors (private mode, quota)
    }
  }, [key, value])

  return [value, setValue] as const
}
