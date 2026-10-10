// The wording is the required affiliate disclosure and stays complete.
// `compact` tightens the boxed version for dialogs; `inline` drops the box
// for page headers, where it sits as a plain line under the title.
export function AffiliateDisclosure({ className = '', compact = false, inline = false }: { className?: string; compact?: boolean; inline?: boolean }) {
  const look = inline
    ? 'text-xs leading-relaxed text-ink-4'
    : `rounded-xl border border-line bg-surface-2 text-xs text-ink-3 ${compact ? 'px-2.5 py-1.5 leading-snug' : 'px-3 py-2 leading-relaxed'}`
  return (
    <p className={`${look} ${className}`.trim()}>
      As an Amazon Associate I earn from qualifying purchases. As an eBay Partner, CarPartsRadar may be compensated if you make a purchase.{' '}
      <a href="/affiliate-disclosure.html" className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300">
        How affiliate links work
      </a>
    </p>
  )
}
