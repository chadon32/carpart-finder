import { useEffect, useRef, type ReactNode } from 'react'

// Accessible modal shell shared by every dialog in the app:
// - role="dialog" + aria-modal so screen readers announce it correctly
// - focuses the panel on open and restores focus to the trigger on close
// - traps Tab/Shift+Tab inside the dialog
// - closes on Escape and backdrop click
// - locks body scroll while open
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
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [])

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
