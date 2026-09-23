export function AffiliateDisclosure({ className = '' }: { className?: string }) {
  return (
    <p className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 ${className}`.trim()}>
      As an Amazon Associate I earn from qualifying purchases. As an eBay Partner, CarPartsRadar may be compensated if you make a purchase.{' '}
      <a href="/affiliate-disclosure.html" className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300">
        How affiliate links work
      </a>
    </p>
  )
}
