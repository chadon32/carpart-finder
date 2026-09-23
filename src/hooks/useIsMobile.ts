import { useEffect, useState } from 'react'

// Below Tailwind's `sm:` breakpoint — the app's single mobile/desktop boundary.
const QUERY = '(max-width: 639px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    // A resize can occur after render but before this subscription starts
    // (for example while a lazy dialog opens). Reconcile that missed change.
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
