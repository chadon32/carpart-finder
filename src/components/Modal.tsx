import { useEffect, useRef, type ReactNode } from 'react'
import { Drawer } from 'vaul'
import { useIsMobile } from '../hooks/useIsMobile'

// Accessible modal shell shared by every dialog in the app.
// Desktop (>=640px): centered dialog with its own focus trap, Escape,
// backdrop close, and body scroll lock. Mobile (<640px): a vaul bottom
// sheet — drag handle, swipe-down dismiss, safe-area padding; vaul/Radix
// supplies dialog semantics, focus management, and scroll lock there.
// `maxWidth` only applies to the desktop dialog; sheets are full-width.
export function Modal({
  label,
  onClose,
  children,
  maxWidth = 'max-w-2xl',
}: {
  label: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}) {
  const isMobile = useIsMobile()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isMobile) return
    restoreRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [isMobile])

  if (isMobile) {
    return (
      <Drawer.Root open onOpenChange={(open) => { if (!open) onClose() }}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white outline-none dark:bg-slate-900">
            <Drawer.Title className="sr-only">{label}</Drawer.Title>
            <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe">
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !panelRef.current) return
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-950/45 backdrop-blur-[2px] px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full ${maxWidth} animate-slide-up overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-100 outline-none`}
      >
        {children}
      </div>
    </div>
  )
}
