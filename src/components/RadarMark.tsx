// The brand mark: a radar scope with a live sweep. The same mark doubles as
// the loading indicator — "scanning" is literally what the product does, so
// the logo and the loader are one object. Sweep/blip animate via the
// .radar-sweep/.radar-blip classes (collapsed under prefers-reduced-motion).
export function RadarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
      <g className="radar-sweep">
        <path d="M12 12 L4.72 5.89 A9.5 9.5 0 0 1 12 2.5 Z" fill="currentColor" fillOpacity="0.28" />
        <line x1="12" y1="12" x2="12" y2="2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </g>
      <circle className="radar-blip" cx="16.4" cy="8.2" r="1.5" fill="currentColor" />
    </svg>
  )
}
