import { lazy, Suspense } from 'react'

const OwnerAnalyticsDashboard = lazy(() =>
  import('./components/OwnerAnalyticsDashboard').then((module) => ({
    default: module.OwnerAnalyticsDashboard,
  })),
)

export function OwnerRoute() {
  return (
    <Suspense
      fallback={
        <div role="status" className="p-8">
          Loading owner dashboard…
        </div>
      }
    >
      <OwnerAnalyticsDashboard />
    </Suspense>
  )
}
