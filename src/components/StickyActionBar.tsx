import type { ReactNode } from 'react'

// Mobile-only sticky bar floating directly above the BottomNav (h-14 =
// 3.5rem), keeping a step's primary call-to-action within thumb reach.
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200/70 bg-white/95 px-4 py-2.5 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/95 sm:hidden">
      {children}
    </div>
  )
}
