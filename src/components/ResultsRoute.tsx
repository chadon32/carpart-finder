import { lazy, Suspense, type ReactNode } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { usePartsSearch } from '../hooks/usePartsSearch'
import type { ResultsListProps } from './ResultsList'

const ResultsList = lazy(() => import('./ResultsList').then((module) => ({ default: module.ResultsList })))

export function ResultsRoute({ fallback, ...props }: ResultsListProps & { fallback: ReactNode }) {
  const [storedZip, setZip] = usePersistedState<string>('cpf-zip', '')
  const zip = typeof storedZip === 'string' ? storedZip : ''
  const search = usePartsSearch(props.car, props.part, zip)

  // This inner boundary allows the route to commit and start its fetch while
  // the larger results UI loads. Moving the boundary above this component
  // would delay its effect and recreate the code -> request waterfall.
  return (
    <Suspense fallback={fallback}>
      <ResultsList {...props} search={search} zip={zip} onZipChange={setZip} />
    </Suspense>
  )
}
