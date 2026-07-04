import { useEffect, useRef } from 'react'

interface HeadroomConstructor {
  new (element: HTMLElement, options?: HeadroomOptions): Headroom
}

interface HeadroomOptions {
  offset?: number | { up: number; down: number }
  tolerance?: number | { up: number; down: number }
  zIndex?: number
}

interface Headroom {
  init(): void
  destroy(): void
  pin(): void
  unpin(): void
  freeze(): void
  unfreeze(): void
}

declare const Headroom: HeadroomConstructor

interface UseHeadroomOptions {
  offset?: number
  tolerance?: number | { up: number; down: number }
  zIndex?: number
}

interface UseHeadroomReturn {
  headroomRef: React.RefObject<HTMLElement | null>
  headroom: Headroom | null
}

export function useHeadroom(options?: UseHeadroomOptions): UseHeadroomReturn {
  const headroomRef = useRef<HTMLElement | null>(null)
  const headroomRef_ = useRef<Headroom | null>(null)

  useEffect(() => {
    const element = headroomRef.current
    if (!element) return

    // Defer initialization to handle scroll restoration on page reload
    const timeoutId = setTimeout(() => {
      headroomRef_.current = new Headroom(element, {
        offset: options?.offset ?? 48,
        tolerance: options?.tolerance ?? 5,
        zIndex: options?.zIndex ?? 9999,
      })
      headroomRef_.current.init()
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (headroomRef_.current) {
        headroomRef_.current.destroy()
        headroomRef_.current = null
      }
    }
  }, [options])

  return {
    headroomRef,
    headroom: headroomRef_.current,
  }
}
