import { useEffect, useState } from 'react'
import { Car as CarIcon } from 'lucide-react'
import { fetchVehicleImage } from '../api/client'

// Module-level cache (and in-flight promise dedupe) so CarSelector,
// PartSelector, and ResultsList can all request the same make/model in the
// same session without triggering duplicate network requests.
const cache = new Map<string, Promise<string | null>>()

function getImage(make: string, model: string, year?: string): Promise<string | null> {
  const key = year ? `${year}::${make}::${model}`.toLowerCase() : `${make}::${model}`.toLowerCase()
  let promise = cache.get(key)
  if (!promise) {
    promise = fetchVehicleImage(make, model, year)
      .then((res) => res.imageUrl)
      .catch(() => null)
    cache.set(key, promise)
  }
  return promise
}

// `className` should size the (landscape) frame — car photos are wide, so a
// landscape box with object-cover shows the whole vehicle instead of a
// center-cropped sliver.
export function VehicleThumbnail({
  make,
  model,
  year,
  className = 'h-14 w-20',
  iconSize = 22,
}: {
  make: string
  model: string
  year?: string
  className?: string
  iconSize?: number
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    getImage(make, model, year).then((url) => {
      if (cancelled) return
      setImageUrl(url)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [make, model, year])

  const frame = `${className} shrink-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm`

  if (loading) {
    return <div className={`${frame} animate-pulse bg-slate-100`} />
  }

  if (!imageUrl || failed) {
    return (
      <div className={`${frame} flex items-center justify-center bg-brand-50 text-brand-400`}>
        <CarIcon size={iconSize} strokeWidth={1.8} />
      </div>
    )
  }

  return (
    <div className={`${frame} bg-slate-50 ring-1 ring-slate-100`}>
      <img
        src={imageUrl}
        alt={`${make} ${model}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  )
}
