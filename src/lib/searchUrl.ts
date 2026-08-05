import type { Car } from '../components/CarSelector'
import { isValidPartQuery, normalizePartQuery } from './searchInput.js'

export type Step = 'car' | 'part' | 'results'

export type AppRoute = {
  step: Step
  car: Car | null
  part: string | null
}

// The URL is the source of truth for a shareable search. Query shape:
//   /                                            -> car selection (home)
//   /?year=..&make=..&model=..&trim=..           -> part selection
//   /?year=..&make=..&model=..&trim=..&part=..   -> results
export function routeFromSearch(search: string): AppRoute {
  const p = new URLSearchParams(search)
  const year = p.get('year')?.trim() || ''
  const make = p.get('make')?.trim() || ''
  const model = p.get('model')?.trim() || ''
  const trim = p.get('trim')?.trim() || ''
  const rawPart = normalizePartQuery(p.get('part') || '')
  const part = isValidPartQuery(rawPart) ? rawPart : ''

  const carComplete = Boolean(year && make && model)
  if (!carComplete) return { step: 'car', car: null, part: null }

  const car: Car = { year, make, model, trim }
  if (part) return { step: 'results', car, part }
  return { step: 'part', car, part: null }
}

export function searchFromRoute(route: AppRoute): string {
  if (!route.car) return ''
  const p = new URLSearchParams()
  p.set('year', route.car.year)
  p.set('make', route.car.make)
  p.set('model', route.car.model)
  if (route.car.trim) p.set('trim', route.car.trim)
  const normalizedPart = normalizePartQuery(route.part || '')
  if (route.step === 'results' && isValidPartQuery(normalizedPart)) p.set('part', normalizedPart)
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}
