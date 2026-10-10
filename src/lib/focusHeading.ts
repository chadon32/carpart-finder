// After the screen changes, keyboard and screen-reader focus belongs on the new
// screen's heading: it announces where you are in a few words. Focusing the
// whole <main> made assistive technology start by reading the page's entire
// text. The next screen may still be downloading (it is loaded lazily), so keep
// looking for its heading for a few seconds before settling for <main>.
let latestRequest = 0

export function focusPageHeading(main: HTMLElement | null, attempts = 40) {
  if (!main) return
  const request = ++latestRequest

  const tryFocus = (remaining: number) => {
    if (request !== latestRequest) return
    const heading = main.querySelector<HTMLElement>('h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
      return
    }
    if (remaining > 0) window.setTimeout(() => tryFocus(remaining - 1), 75)
    else main.focus({ preventScroll: true })
  }

  requestAnimationFrame(() => tryFocus(attempts))
}
