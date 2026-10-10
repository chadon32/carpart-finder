import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError, requestPasswordReset, resetPassword } from '../api/supabase'
import { useAppContext } from '../contexts/useAppContext'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Step one: ask for a link. The page says the same thing whether or not an
// account exists for the address, so it cannot be used to look people up.
export function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const submit = async () => {
    const address = email.trim()
    if (!EMAIL_PATTERN.test(address)) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    setSending(true)
    try {
      await requestPasswordReset(address)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 503
        ? 'Accounts are temporarily unavailable. Search and price comparison still work.'
        : err instanceof Error ? err.message : 'Could not send the link. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); void submit() }}>
      <div className="mb-6 text-center">
        <h3 className="section-title dark:text-white">Reset your password</h3>
        <p className="mt-2 text-sm text-ink-4">Enter your email and we will send you a link to choose a new password.</p>
      </div>

      {sent && (
        <p role="status" className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          If an account exists for that email, a reset link is on its way. It can take a few minutes; check your spam folder too.
        </p>
      )}

      <div className="mb-6">
        <label htmlFor="forgot-email" className="field-label">Email</label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          maxLength={254}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'forgot-email-error' : undefined}
          className="field"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null) }}
        />
        {error && <p id="forgot-email-error" role="alert" className="mt-1.5 text-sm text-rose-600">{error}</p>}
      </div>

      <button type="submit" disabled={sending} className="btn btn-primary w-full py-3">
        {sending ? 'Sending…' : sent ? 'Send it again' : 'Send reset link'}
      </button>

      <div className="mt-6 border-t border-line-soft pt-5 text-center dark:border-slate-800/60">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-medium text-ink-4 transition hover:text-brand-600">
          Back to sign in
        </button>
      </div>
    </form>
  )
}

// Step two, reached from the emailed link: choose a new password. Success also
// signs the person in, since the link already proved they own the mailbox.
export function ResetPasswordCard({ token, onDone, onRequestNewLink }: { token: string; onDone: () => void; onRequestNewLink: () => void }) {
  const { setUser, setRecoveryToken } = useAppContext()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldError, setFieldError] = useState<{ password?: string; confirm?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const problems: { password?: string; confirm?: string } = {}
    if (password.length < 8) problems.password = 'Use at least 8 characters.'
    if (confirm !== password) problems.confirm = 'The two passwords do not match.'
    if (problems.password || problems.confirm) {
      setFieldError(problems)
      return
    }
    setFieldError(null)
    setError(null)
    setSaving(true)
    try {
      const res = await resetPassword(token, password)
      const email = res.user?.email || ''
      const user = { name: res.user?.user_metadata?.full_name || email.split('@')[0] || 'User', email }
      localStorage.setItem('carpartsradar-user', JSON.stringify(user))
      setUser(user)
      setRecoveryToken(null)
      toast.success('Password updated. You are signed in.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the new password. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-md animate-slide-up card p-8">
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <div className="mb-6 text-center">
          <h3 className="section-title dark:text-white">Choose a new password</h3>
          <p className="mt-2 text-sm text-ink-4">You will be signed in once it is saved.</p>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            {error}{' '}
            <button type="button" onClick={() => { setRecoveryToken(null); onRequestNewLink() }} className="font-semibold underline">Request a new link</button>
          </p>
        )}

        <div className="mb-4">
          <label htmlFor="reset-password" className="field-label">New password</label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            placeholder="At least 8 characters"
            aria-invalid={Boolean(fieldError?.password)}
            aria-describedby={fieldError?.password ? 'reset-password-error' : undefined}
            className="field"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldError(null) }}
          />
          {fieldError?.password && <p id="reset-password-error" role="alert" className="mt-1.5 text-sm text-rose-600">{fieldError.password}</p>}
        </div>

        <div className="mb-6">
          <label htmlFor="reset-confirm" className="field-label">Confirm new password</label>
          <input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            aria-invalid={Boolean(fieldError?.confirm)}
            aria-describedby={fieldError?.confirm ? 'reset-confirm-error' : undefined}
            className="field"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setFieldError(null) }}
          />
          {fieldError?.confirm && <p id="reset-confirm-error" role="alert" className="mt-1.5 text-sm text-rose-600">{fieldError.confirm}</p>}
        </div>

        <button type="submit" disabled={saving} className="btn btn-primary w-full py-3">
          {saving ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  )
}
