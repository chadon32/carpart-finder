import type { Car } from '../components/CarSelector'
import { isValidPartQuery, normalizePartQuery } from './searchInput.js'
import { guideSearchStart } from '../data/guideSearch'

export type Step = 'car' | 'part' | 'results'

export type AppRoute = {
  step: Step
  car: Car | null
  part: string | null
  guide?: string | null
}

// The URL is the source of truth for a shareable search. Query shape:
//   /?guide=<allow-listed-id>                    -> car selection from a guide
//   /?year=..&make=..&model=..&trim=..           -> part selection
//   /?year=..&make=..&model=..&trim=..&part=..   -> results
// Guide ids are validated against the editorial map; no user-entered search
// text is carried by this marketing entry point.
export function routeFromSearch(search: string): AppRoute {
  const p = new URLSearchParams(search)
  const guide = guideSearchStart(p.get('guide'))?.id ?? null
  const year = p.get('year')?.trim() || ''
  const make = p.get('make')?.trim() || ''
  const model = p.get('model')?.trim() || ''
  const trim = p.get('trim')?.trim() || ''
  const rawPart = normalizePartQuery(p.get('part') || '')
  const part = isValidPartQuery(rawPart) ? rawPart : ''

  const carComplete = Boolean(year && make && model)
  if (!carComplete) return { step: 'car', car: null, part: null, guide }

  const car: Car = { year, make, model, trim }
  if (part) return { step: 'results', car, part, guide }
  return { step: 'part', car, part: null, guide }
}

export function searchFromRoute(route: AppRoute): string {
  const p = new URLSearchParams()
  const guide = guideSearchStart(route.guide)?.id
  if (guide) p.set('guide', guide)
  if (!route.car) return p.toString() ? `?${p.toString()}` : ''
  p.set('year', route.car.year)
  p.set('make', route.car.make)
  p.set('model', route.car.model)
  if (route.car.trim) p.set('trim', route.car.trim)
  const normalizedPart = normalizePartQuery(route.part || '')
  if (route.step === 'results' && isValidPartQuery(normalizedPart)) p.set('part', normalizedPart)
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}
