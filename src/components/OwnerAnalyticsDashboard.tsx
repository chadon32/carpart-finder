import { useEffect, useState, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Car,
  ExternalLink,
  LockKeyhole,
  LogOut,
  RefreshCw,
} from 'lucide-react'
import { RadarMark } from './RadarMark'
import {
  analyticsPercent,
  OwnerApiError,
  ownerRequest,
  type AnalyticsBreakdown,
  type WebsiteAnalytics,
} from '../api/ownerAnalytics'
import './owner-analytics.css'

const number = (value: number) => new Intl.NumberFormat('en-US').format(value)
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Phoenix',
  }).format(new Date(`${value}T12:00:00Z`))
const labels: Record<string, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  desktop: 'Desktop',
  direct: 'Direct / internal',
  search: 'Search engines',
  social: 'Social media',
  referral: 'Other websites',
  amazon: 'Amazon',
  ebay: 'eBay',
  autozone: 'AutoZone',
  rockauto: 'RockAuto',
  oreilly: 'O’Reilly',
  napa: 'NAPA',
  'advance-auto-parts': 'Advance Auto',
  walmart: 'Walmart',
  'summit-racing': 'Summit Racing',
  'google-shopping': 'Google Shopping',
  aliexpress: 'AliExpress',
  other: 'Other',
  home: 'Homepage',
  'part-selection': 'Part selection',
  results: 'Search results',
  watchlist: 'Watchlist',
  guides: 'Guide index',
  guide: 'Buying guides',
  about: 'About',
  methodology: 'Methodology',
  contact: 'Contact',
  privacy: 'Privacy',
  terms: 'Terms',
  'affiliate-disclosure': 'Affiliate disclosure',
  'Added to Watchlist': 'Watchlist saves',
  'Price Alert Created': 'Price alerts',
  'Generated AI Repair Guide': 'Repair guides',
  comparison_checklist_shared: 'Comparison shares',
}

function Breakdown({
  title,
  description,
  rows,
  denominator,
}: {
  title: string
  description: string
  rows: AnalyticsBreakdown[]
  denominator: number
}) {
  return (
    <section className="owner-panel">
      <h2>{title}</h2>
      <p className="owner-muted">{description}</p>
      {rows.length ? (
        <ul className="owner-breakdown">
          {rows.map((row) => (
            <li key={row.key}>
              <div>
                <span>{labels[row.key] || 'Other'}</span>
                <strong>
                  {number(row.count)} <small>{analyticsPercent(row.count, denominator)}</small>
                </strong>
              </div>
              <div className="owner-track" aria-hidden="true">
                <span
                  style={{
                    width: `${denominator ? Math.min(100, (row.count / denominator) * 100) : 0}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="owner-empty-detail">No recorded activity in this range.</p>
      )}
    </section>
  )
}

function Report({ report }: { report: WebsiteAnalytics }) {
  const totals = report.totals
  const maxDaily = Math.max(1, ...report.daily.map((day) => day.visits))
  return (
    <>
      {!totals.visits && (
        <section className="owner-notice" role="status">
          <strong>No visits recorded in this range yet.</strong>
          <p>
            These are real counts, not demo data. Collection starts after the analytics backend is
            enabled; blocked tracking, privacy opt-outs, and known bots are excluded.
          </p>
        </section>
      )}
      <section className="owner-metrics" aria-label="Website totals">
        {[
          [
            'Daily unique visitors',
            totals.dailyVisitors,
            'Anonymous daily estimates; repeat days can count again.',
          ],
          [
            'Visits',
            totals.visits,
            'Browser-tab visits; reset after 30 idle minutes or Phoenix midnight.',
          ],
          [
            'Part searches',
            totals.searches,
            'Search attempts, including retries and shared search links.',
          ],
          ['Store clicks', totals.retailerClicks, 'Outbound clicks, not confirmed purchases.'],
        ].map(([label, count, detail]) => (
          <article className="owner-metric" key={String(label)}>
            <h2>{label}</h2>
            <strong>{number(Number(count))}</strong>
            <p>{detail}</p>
          </article>
        ))}
      </section>
      <section className="owner-panel owner-trend" id="traffic-trend">
        <div className="owner-section-heading">
          <div>
            <p className="owner-eyebrow">Traffic over time</p>
            <h2>How is website traffic changing?</h2>
            <p className="owner-muted">
              Daily visits · {dateLabel(report.startDate)} – {dateLabel(report.endDate)} · Phoenix
              time
            </p>
          </div>
          <div className="owner-trend-total">
            <strong>{number(totals.pageviews)}</strong>
            <span>page / screen views</span>
          </div>
        </div>
        <div
          className="owner-chart"
          role="img"
          aria-label={`${number(totals.visits)} visits over ${report.days} days. Daily counts are available in the table below.`}
        >
          {report.daily.map((day) => (
            <div
              key={day.day}
              className="owner-chart-column"
              title={`${dateLabel(day.day)}: ${day.visits} visits, ${day.searches} searches, ${day.clicks} store clicks`}
            >
              <span style={{ height: `${(day.visits / maxDaily) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="owner-chart-labels" aria-hidden="true">
          <span>{dateLabel(report.startDate)}</span>
          <span>{dateLabel(report.endDate)}</span>
        </div>
        <details className="owner-daily-table">
          <summary>View daily numbers</summary>
          <div
            className="owner-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable daily activity table"
          >
            <table>
              <caption>Daily website activity in America/Phoenix</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Visitors*</th>
                  <th scope="col">Visits</th>
                  <th scope="col">Views</th>
                  <th scope="col">Searches</th>
                  <th scope="col">Store clicks</th>
                </tr>
              </thead>
              <tbody>
                {report.daily.map((day) => (
                  <tr key={day.day}>
                    <th scope="row">{dateLabel(day.day)}</th>
                    {[day.visitors, day.visits, day.pageviews, day.searches, day.clicks].map(
                      (value, index) => (
                        <td key={index}>{number(value)}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="owner-muted">* Daily estimates, not identified people.</p>
        </details>
      </section>
      <section className="owner-panel" id="visitor-funnel">
        <div className="owner-section-heading">
          <div>
            <p className="owner-eyebrow">Visitor journey</p>
            <h2>How far do people get?</h2>
            <p className="owner-muted">
              Each visit counts once per stage. Shared links count as reaching the stages they skip.
            </p>
          </div>
          <div className="owner-rate-summary">
            <span>
              <Activity size={16} aria-hidden="true" />{' '}
              {analyticsPercent(totals.engagedVisits, totals.visits)} engaged
            </span>
            <span>
              <ArrowUpRight size={16} aria-hidden="true" />{' '}
              {analyticsPercent(totals.storeClickVisits, totals.visits)} reached a store
            </span>
          </div>
        </div>
        <ol className="owner-funnel">
          {report.funnel.map((step, index) => {
            const previous = index ? report.funnel[index - 1].count : step.count
            const dropped = Math.max(0, previous - step.count)
            return (
              <li key={step.rank}>
                <span className="owner-step-number">{index + 1}</span>
                <div className="owner-funnel-main">
                  <div className="owner-funnel-label">
                    <strong>{step.label}</strong>
                    <span>
                      {number(step.count)}{' '}
                      <small>{analyticsPercent(step.count, totals.visits)} of visits</small>
                    </span>
                  </div>
                  <div className="owner-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${totals.visits ? Math.min(100, (step.count / totals.visits) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="owner-funnel-drop">
                  {index ? (
                    <>
                      <span>{analyticsPercent(step.count, previous)} continue</span>
                      <small>
                        <ArrowDownRight size={13} aria-hidden="true" /> {number(dropped)} stop
                        before this stage
                      </small>
                    </>
                  ) : (
                    <span>Starting point</span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        <p className="owner-footnote">
          This measures the furthest stage reached, not a timed, strictly ordered conversion
          experiment. Engagement means at least one recorded action beyond viewing a page; it does
          not measure satisfaction.
        </p>
      </section>
      <div className="owner-grid" id="traffic-sources">
        <Breakdown
          title="Where visits come from"
          description="Coarse referrer categories; no full referring URLs stored."
          rows={report.sources}
          denominator={totals.visits}
        />
        <Breakdown
          title="Devices"
          description="Visit-level screen-size categories, not device fingerprints."
          rows={report.devices}
          denominator={totals.visits}
        />
        <Breakdown
          title="Stores people click"
          description="Which retailers visitors choose to check next."
          rows={report.retailers}
          denominator={totals.retailerClicks}
        />
        <Breakdown
          title="Pages & screens"
          description="Recorded views, including the public buying guides."
          rows={report.pages}
          denominator={totals.pageviews}
        />
      </div>
      <section className="owner-panel" id="engagement">
        <h2>More signs of interest</h2>
        <p className="owner-muted">
          Useful actions and search friction. These are action counts, not unique people.
        </p>
        <dl className="owner-action-grid">
          {[
            'Added to Watchlist',
            'Price Alert Created',
            'Generated AI Repair Guide',
            'comparison_checklist_shared',
          ].map((key) => (
            <div key={key}>
              <dt>{labels[key]}</dt>
              <dd>{number(report.actions.find((action) => action.key === key)?.count || 0)}</dd>
            </div>
          ))}
          <div>
            <dt>Searches with no results</dt>
            <dd>{number(totals.emptySearches)}</dd>
          </div>
          <div>
            <dt>Failed searches</dt>
            <dd>{number(totals.failedSearches)}</dd>
          </div>
        </dl>
      </section>
      <footer className="owner-footnote">
        {report.firstTrackedAt
          ? `First recorded event: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'America/Phoenix' }).format(new Date(report.firstTrackedAt))}.`
          : 'No historical data is available yet.'}{' '}
        No customer names, emails, VINs, photos, raw search text, IP addresses, or visitor-level
        records are shown.
      </footer>
    </>
  )
}

export function OwnerAnalyticsDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [configured, setConfigured] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [days, setDays] = useState('30')
  const [revision, setRevision] = useState(0)
  const [report, setReport] = useState<WebsiteAnalytics | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void ownerRequest<{ authenticated: boolean; configured: boolean }>('session', {
      signal: controller.signal,
    })
      .then((session) => {
        setAuthenticated(session.authenticated)
        setConfigured(session.configured)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setAuthenticated(false)
          setError(reason instanceof Error ? reason.message : 'Could not check owner access.')
        }
      })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!authenticated) return
    const controller = new AbortController()
    setPending(true)
    setError('')
    setReport(null)
    void ownerRequest<WebsiteAnalytics>(`analytics?days=${days}`, { signal: controller.signal })
      .then((data) => {
        if (
          data.version !== 1 ||
          data.days !== Number(days) ||
          !data.totals ||
          !Array.isArray(data.daily) ||
          !Array.isArray(data.funnel)
        )
          throw new Error('Analytics data could not be verified. Try refreshing.')
        setReport(data)
        setUpdatedAt(
          new Intl.DateTimeFormat('en-US', {
            timeStyle: 'short',
            timeZone: 'America/Phoenix',
          }).format(new Date()),
        )
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        if (reason instanceof OwnerApiError && reason.status === 401) {
          setAuthenticated(false)
          setPassword('')
        }
        setError(reason instanceof Error ? reason.message : 'Analytics is temporarily unavailable.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setPending(false)
      })
    return () => controller.abort()
  }, [authenticated, days, revision])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await ownerRequest('login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setPassword('')
      setAuthenticated(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign in.')
    } finally {
      setPending(false)
    }
  }
  async function logout() {
    setPending(true)
    setError('')
    try {
      await ownerRequest('logout', { method: 'POST', body: '{}' })
      setReport(null)
      setPassword('')
      setAuthenticated(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not sign out. Please try again.')
    } finally {
      setPending(false)
    }
  }
  const metadata = (
    <Helmet>
      <title>Owner analytics | CarPartsRadar</title>
      <meta name="robots" content="noindex, nofollow" />
      <link rel="canonical" href="https://carpartsradar.com/admin" />
    </Helmet>
  )
  if (authenticated === null)
    return (
      <div className="owner-root owner-login-shell">
        {metadata}
        <div role="status" className="owner-loading">
          <RadarMark className="h-8 w-8" />
          <p>Checking owner access…</p>
        </div>
      </div>
    )
  if (!authenticated)
    return (
      <div className="owner-root owner-login-shell">
        {metadata}
        <main className="owner-login-panel">
          <a href="/" className="owner-login-brand">
            <RadarMark className="h-8 w-8" />
            <span>CarPartsRadar</span>
          </a>
          <div className="owner-login-icon">
            <LockKeyhole size={22} aria-hidden="true" />
          </div>
          <p className="owner-eyebrow">Private owner dashboard</p>
          <h1>See what’s on the radar.</h1>
          <p className="owner-muted">
            Website traffic, search progress, and store clicks. Owner access is separate from
            shopper accounts.
          </p>
          {!configured && (
            <p className="owner-notice" role="status">
              Owner access needs server setup. Configure the owner email, password hash, and session
              secret before signing in.
            </p>
          )}
          <form onSubmit={(event) => void login(event)}>
            <label htmlFor="owner-email">Owner email</label>
            <input
              id="owner-email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending || !configured}
            />
            <label htmlFor="owner-password">Password</label>
            <input
              id="owner-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending || !configured}
            />
            {error && (
              <p role="alert" className="owner-error">
                {error}
              </p>
            )}
            <button
              className="owner-button owner-primary"
              disabled={pending || !configured}
              type="submit"
            >
              {pending ? 'Signing in…' : 'Sign in to analytics'}
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </form>
          <a className="owner-back-link" href="/">
            Back to the public website
          </a>
        </main>
      </div>
    )
  return (
    <div className="owner-root">
      {metadata}
      <a className="owner-skip" href="#owner-main">
        Skip to analytics
      </a>
      <div className="owner-layout">
        <aside className="owner-sidebar">
          <a className="owner-brand" href="/">
            <RadarMark className="h-8 w-8" />
            <span>
              CarParts<span>Radar</span>
            </span>
          </a>
          <p className="owner-sidebar-caption">OWNER WORKSPACE</p>
          <nav aria-label="Owner workspace">
            <a href="#overview">
              <BarChart3 size={18} aria-hidden="true" /> Overview
            </a>
            <a href="#visitor-funnel">
              <Activity size={18} aria-hidden="true" /> Visitor funnel
            </a>
            <a href="#traffic-sources">
              <Car size={18} aria-hidden="true" /> Traffic & clicks
            </a>
            <a href="#engagement">
              <ArrowUpRight size={18} aria-hidden="true" /> Engagement
            </a>
          </nav>
          <div className="owner-sidebar-bottom">
            <a href="/" target="_blank" rel="noopener noreferrer">
              Open website <ExternalLink size={15} aria-hidden="true" />
            </a>
            <span>
              <LockKeyhole size={13} aria-hidden="true" /> Private · numbers only
            </span>
          </div>
        </aside>
        <main className="owner-main" id="owner-main">
          <header className="owner-header" id="overview">
            <div>
              <p className="owner-eyebrow">CarPartsRadar / measured growth</p>
              <h1>Website analytics</h1>
              <p className="owner-muted">
                Who arrives, how far they get, and what they choose next.
              </p>
            </div>
            <button
              type="button"
              className="owner-button"
              onClick={() => void logout()}
              disabled={pending}
            >
              <LogOut size={16} aria-hidden="true" /> Sign out
            </button>
          </header>
          <div className="owner-toolbar">
            <label htmlFor="owner-period">
              Date range{' '}
              <select
                id="owner-period"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <div>
              <span className="owner-muted">
                {updatedAt ? `Updated ${updatedAt} · Phoenix` : 'Phoenix calendar days'}
              </span>
              <button
                className="owner-button"
                type="button"
                onClick={() => setRevision((value) => value + 1)}
                disabled={pending}
              >
                <RefreshCw size={15} className={pending ? 'owner-spin' : ''} aria-hidden="true" />{' '}
                Refresh
              </button>
            </div>
          </div>
          {error && (
            <section className="owner-error" role="alert">
              <strong>Analytics unavailable</strong>
              <p>{error}</p>
              <p>Unavailable data is not shown as zero. Check the backend setup or try Refresh.</p>
            </section>
          )}
          {pending && (
            <div className="owner-loading" role="status">
              <RadarMark className="h-7 w-7" />
              <p>Loading website numbers…</p>
            </div>
          )}
          {report && <Report report={report} />}
        </main>
      </div>
    </div>
  )
}
