import { useRef, useState } from 'react'
import { AlertTriangle, Check, Clipboard, ExternalLink, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { Listing } from '../api/client'
import type { Car } from './CarSelector'
import { AffiliateDisclosure } from './AffiliateDisclosure'
import { OutboundLink } from './OutboundLink'
import {
  buildComparisonShareText,
  comparisonCoreChargeLabel,
  comparisonFitmentLabel,
  comparisonFitmentCheckedTimestamp,
  comparisonListingFreshnessLabel,
  comparisonShippingLabel,
  formatComparisonMoney,
  privacySafeRetailerUrl,
  privacySafeShareValue,
} from '../lib/comparisonShare'
import { knownTotalCost } from '../lib/listingHelpers'
import { trackComparisonChecklistShared } from '../lib/analytics'

export function ComparisonShareCard({
  listings,
  vehicle,
  part,
}: {
  listings: Listing[]
  vehicle: Car
  part: string
}) {
  const [copied, setCopied] = useState(false)
  const copyInFlight = useRef(false)

  const copyChecklist = async () => {
    if (copyInFlight.current) return
    copyInFlight.current = true
    setCopied(false)
    try {
      await navigator.clipboard.writeText(buildComparisonShareText({ vehicle, part, listings }))
      setCopied(true)
      toast.success('Comparison checklist copied')
      trackComparisonChecklistShared({
        listingCount: listings.length,
        structuredEvidenceCount: listings.filter((listing) => listing.verifiedFitment === true).length,
        keywordMatchCount: listings.filter((listing) => listing.verifiedFitment !== true).length,
        knownTotalCount: listings.filter((listing) => knownTotalCost(listing) != null).length,
        retailerLinkCount: listings.filter((listing) => Boolean(listing.link)).length,
      })
    } catch {
      toast.error('Could not copy the checklist. Select the comparison text and copy it manually.')
    } finally {
      copyInFlight.current = false
    }
  }

  return (
    <section
      aria-labelledby="comparison-share-heading"
      className="mx-6 mt-5 overflow-hidden rounded-2xl border border-brand-200/80 bg-brand-50/50 dark:border-brand-900/50 dark:bg-brand-950/20"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brand-200/70 px-4 py-4 dark:border-brand-900/50">
        <div className="min-w-0">
          <p className="eyebrow text-brand-700 dark:text-brand-300">Shareable snapshot</p>
          <h4 id="comparison-share-heading" className="mt-1 text-base font-bold tracking-tight text-slate-950 dark:text-slate-50">
            Fitment and delivered-cost checklist
          </h4>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Copy the vehicle label and listing facts for a mechanic or friend to review. It never includes a VIN, account, email, or user notes.
          </p>
        </div>
        <button type="button" onClick={() => void copyChecklist()} className="btn btn-secondary shrink-0 px-3 py-2 text-xs">
          {copied ? <Check size={14} className="text-emerald-600" /> : <Clipboard size={14} />}
          {copied ? 'Copied' : 'Copy checklist'}
        </button>
      </div>

      <div className="grid gap-3 border-b border-brand-200/70 px-4 py-3 text-xs dark:border-brand-900/50 sm:grid-cols-2">
        <div>
          <span className="font-semibold text-slate-600 dark:text-slate-300">Vehicle label</span>
          <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
            {privacySafeShareValue([vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '))}
          </div>
        </div>
        <div>
          <span className="font-semibold text-slate-600 dark:text-slate-300">Part</span>
          <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{privacySafeShareValue(part)}</div>
        </div>
      </div>

      <ul className="grid gap-3 p-4 sm:grid-cols-2">
        {listings.map((listing) => {
          const verified = listing.verifiedFitment === true
          const total = knownTotalCost(listing)
          return (
            <li key={listing.id} className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h5 className="break-anywhere text-sm font-semibold leading-snug text-slate-950 dark:text-slate-50">{privacySafeShareValue(listing.title)}</h5>
                  <p className="mt-1 text-[11px] text-slate-500">{privacySafeShareValue(listing.source || 'Retailer unavailable')}</p>
                </div>
                {verified ? <ShieldCheck size={16} className="shrink-0 text-emerald-600" aria-hidden /> : <AlertTriangle size={16} className="shrink-0 text-amber-600" aria-hidden />}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                <div>
                  <dt className="text-slate-500">Item price</dt>
                  <dd className="font-data font-semibold text-slate-900 dark:text-slate-100">{formatComparisonMoney(listing.price)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Known shipping</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">{comparisonShippingLabel(listing)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Core charge</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">{comparisonCoreChargeLabel(listing)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Known total before tax</dt>
                  <dd className="font-data font-semibold text-slate-900 dark:text-slate-100">{formatComparisonMoney(total)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Fitment evidence checked</dt>
                  <dd className="font-data break-anywhere text-slate-900 dark:text-slate-100">{comparisonFitmentCheckedTimestamp(listing)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-slate-500">Listing freshness</dt>
                  <dd className="font-data break-anywhere text-slate-900 dark:text-slate-100">{comparisonListingFreshnessLabel(listing)}</dd>
                </div>
              </dl>

              <p className={`mt-3 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed ${verified ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'}`}>
                {comparisonFitmentLabel(listing)}
              </p>

              <OutboundLink href={privacySafeRetailerUrl(listing.link)} className="btn btn-ghost mt-2 min-h-11 px-2 text-xs text-brand-700 dark:text-brand-300">
                Confirm at retailer <ExternalLink size={12} />
              </OutboundLink>
            </li>
          )
        })}
      </ul>

      <div className="border-t border-brand-200/70 px-4 py-3 text-[11px] leading-relaxed text-slate-600 dark:border-brand-900/50 dark:text-slate-300">
        Structured compatibility evidence is evidence, not a guarantee. Keyword matches are broader and do not establish compatibility. Confirm the exact configuration, part number, final price, shipping, core terms, inventory, delivery, and returns with the retailer. CarPartsRadar does not guarantee fitment, price, inventory, delivery, or savings.
      </div>
      <AffiliateDisclosure className="m-4 mt-0 border-brand-200/70 bg-white/70 dark:border-brand-900/50 dark:bg-slate-900/70" />
    </section>
  )
}
