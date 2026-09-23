import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { safeRetailerUrl } from '../../shared/outboundUrl.js'

type OutboundLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: unknown
  children: ReactNode
  unavailableLabel?: string
}

export function OutboundLink({ href, children, unavailableLabel = 'Link unavailable', ...props }: OutboundLinkProps) {
  const safeHref = safeRetailerUrl(href)
  if (!safeHref) {
    return (
      <span aria-disabled="true" className={props.className} title="This retailer link could not be verified.">
        {unavailableLabel}
      </span>
    )
  }

  return (
    <a {...props} href={safeHref} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}
