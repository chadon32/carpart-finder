import { Bookmark, Search, User as UserIcon } from 'lucide-react'

export type BottomTab = 'search' | 'watchlist' | 'account'

// Mobile-only primary navigation: fixed, thumb-reachable, mirrors the
// header's frosted treatment. Desktop keeps the header buttons instead.
export function BottomNav({
  active,
  watchlistCount,
  onSearch,
  onWatchlist,
  onAccount,
}: {
  active: BottomTab
  watchlistCount: number
  onSearch: () => void
  onWatchlist: () => void
  onAccount: () => void
}) {
  const tabs = [
    { id: 'search' as const, label: 'Search', icon: Search, onClick: onSearch },
    { id: 'watchlist' as const, label: 'Watchlist', icon: Bookmark, onClick: onWatchlist },
    { id: 'account' as const, label: 'Account', icon: UserIcon, onClick: onAccount },
  ]

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/95 pb-safe backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/95 sm:hidden"
    >
      <div className="grid h-14 grid-cols-3">
        {tabs.map((t) => {
          const isActive = active === t.id
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={t.onClick}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex touch-manipulation flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="relative">
                <Icon size={21} strokeWidth={isActive ? 2.4 : 2} />
                {t.id === 'watchlist' && watchlistCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">
                    {watchlistCount}
                  </span>
                )}
              </span>
              <span className="font-data text-[10px] font-semibold uppercase tracking-[0.08em]">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
