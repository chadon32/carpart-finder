import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { fetchApiHealth } from '../api/client'

type Readiness = 'checking' | 'ready' | 'unavailable'

function readinessMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('out of date')) {
    return error.message
  }

  return 'Search and account actions may not work until the API is restored.'
}

/**
 * Checks that the browser and API agree on the fitment-safety contract before
 * users rely on live search results. Search and quote requests also enforce
 * this contract, so dismissing or missing this banner cannot bypass it.
 */
export function ApiReadinessBanner() {
  const [status, setStatus] = useState<Readiness>('checking')
  const [message, setMessage] = useState('')
  const mounted = useRef(true)

  const checkReadiness = useCallback(async () => {
    setStatus('checking')

    try {
      await fetchApiHealth()
      if (!mounted.current) return
      setMessage('')
      setStatus('ready')
    } catch (error) {
      if (!mounted.current) return
      setMessage(readinessMessage(error))
      setStatus('unavailable')
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void checkReadiness()

    return () => {
      mounted.current = false
    }
  }, [checkReadiness])

  if (status !== 'unavailable') return null

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
      <div
        className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
        role="alert"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Live service unavailable.</span>{' '}
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void checkReadiness()}
          className="btn inline-flex shrink-0 items-center justify-center gap-2 border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry service check
        </button>
      </div>
    </div>
  )
}
