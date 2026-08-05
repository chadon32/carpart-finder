import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { ApiError, deleteAccount, logoutUser } from '../api/supabase'
import { clearLocalUserData } from '../lib/clearLocalUserData.js'
import {
  accountDeletionErrorMessage,
  accountDeletionRequiresReauthentication,
  canStartAccountDeletion,
} from '../lib/accountDeletionState.js'

interface DeleteAccountPanelProps {
  onDeleted: () => void
  onSessionExpired?: () => void
  startExpanded?: boolean
}

export function DeleteAccountPanel({ onDeleted, onSessionExpired, startExpanded = false }: DeleteAccountPanelProps) {
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deletionStarted = useRef(false)
  const details = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (startExpanded && details.current) details.current.open = true
  }, [startExpanded])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canStartAccountDeletion({ confirmation, deleting, started: deletionStarted.current })) return

    deletionStarted.current = true
    setDeleting(true)
    setError(null)
    try {
      await deleteAccount()
      // The server deletion is authoritative. A transient logout request must
      // not turn a completed permanent deletion into a false failure state.
      try {
        await logoutUser()
      } catch {
        // The deleted user's token is no longer valid; local cleanup below
        // removes every client-owned session/cache value we can control.
      }
      clearLocalUserData()
      onDeleted()
    } catch (err) {
      if (accountDeletionRequiresReauthentication(err) && onSessionExpired) {
        onSessionExpired()
        return
      }
      setError(accountDeletionErrorMessage(err instanceof ApiError || err instanceof Error ? err : null))
      deletionStarted.current = false
      setDeleting(false)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/60 p-5 dark:border-rose-900/60 dark:bg-rose-950/20" aria-labelledby="delete-account-heading">
      <div className="flex items-start gap-3">
        <div className="icon-tile shrink-0 bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0">
          <h3 id="delete-account-heading" className="font-semibold text-rose-950 dark:text-rose-100">Danger zone</h3>
          <p className="mt-1 text-sm leading-relaxed text-rose-800 dark:text-rose-200">
            Permanently delete your account and all saved searches, alerts, and associated data. This cannot be undone.
          </p>
        </div>
      </div>

      <details ref={details} className="mt-4 rounded-xl border border-rose-200 bg-white/70 p-4 dark:border-rose-900/60 dark:bg-slate-900/50">
        <summary className="cursor-pointer text-sm font-semibold text-rose-700 outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:text-rose-300">
          Delete my account
        </summary>
        <div className="mt-4 border-t border-rose-100 pt-4 dark:border-rose-900/50">
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            All saved searches, price alerts, and account data will be permanently removed. Type <strong>DELETE</strong> to confirm.
          </p>
          <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-3">
            <label htmlFor="delete-account-confirmation" className="field-label">Confirmation</label>
            <input
              id="delete-account-confirmation"
              type="text"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value)
                setError(null)
              }}
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              placeholder="DELETE"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'delete-account-error' : 'delete-account-help'}
              className="field max-w-xs border-rose-200 focus:border-rose-500 focus:ring-rose-500 dark:border-rose-900"
            />
            {!error && <p id="delete-account-help" className="text-xs text-slate-500">This confirmation prevents accidental deletion.</p>}
            {error && <p id="delete-account-error" role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
            <button
              type="submit"
              disabled={deleting || confirmation !== 'DELETE'}
              className="btn w-full border border-rose-700 bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <Trash2 size={15} />
              {deleting ? 'Deleting account...' : 'Delete account permanently'}
            </button>
          </form>
        </div>
      </details>
    </section>
  )
}
