import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { siteReachable } from '../lib/lazyWithRecovery'

const DOWNLOAD_FAILURE = /dynamically imported module|importing a module script|loading chunk|failed to fetch/i

type Props = { children: ReactNode }
type State = { error: Error | null; stillOffline: boolean; checking: boolean }

// Without a boundary a rendering error unmounts the whole app and leaves a
// white page. The vehicle and part live in the address bar, so reloading or
// starting over never loses the search.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stillOffline: false, checking: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, stillOffline: false, checking: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen failed to render', error, info.componentStack)
  }

  // A failed download is remembered by the browser until the page reloads, so
  // reloading is the retry. Check the site answers first: reloading while
  // offline would replace the app with the browser's own error page.
  retry = async () => {
    this.setState({ checking: true, stillOffline: false })
    if (await siteReachable()) {
      window.location.reload()
      return
    }
    this.setState({ checking: false, stillOffline: true })
  }

  render() {
    const { error, stillOffline, checking } = this.state
    if (!error) return this.props.children

    const download = DOWNLOAD_FAILURE.test(error.message)
    return (
      <div role="alert" className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertTriangle className="text-red-500" size={28} aria-hidden="true" />
        <h2 className="mt-2 font-semibold text-red-800">
          {download ? "This page didn't load" : 'Something went wrong'}
        </h2>
        <p className="mt-1 text-sm text-red-700">
          {download
            ? 'Check your connection and try again. Your vehicle and part are kept in the address, so nothing is lost.'
            : 'Try again. If it keeps happening, start over from the home page.'}
        </p>
        {stillOffline && (
          <p role="status" className="mt-2 text-sm font-semibold text-red-800">
            Still can't reach CarPartsRadar. Check your connection, then try again.
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={this.retry} disabled={checking} className="btn btn-primary px-5 py-2">
            <RotateCw size={15} aria-hidden="true" /> {checking ? 'Checking…' : 'Try again'}
          </button>
          <a href="/" className="btn btn-secondary px-5 py-2">Start over</a>
        </div>
      </div>
    )
  }
}
