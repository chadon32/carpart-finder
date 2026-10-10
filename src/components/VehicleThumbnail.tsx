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
  tone = 'light',
}: {
  make: string
  model: string
  year?: string
  className?: string
  iconSize?: number
  // "dark" for placement on the dark spec plate, so the frame never flashes white.
  tone?: 'light' | 'dark'
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

  const dark = tone === 'dark'
  const frame = `${className} shrink-0 overflow-hidden rounded-2xl border shadow-sm ${dark ? 'border-white/10' : 'border-line'}`

  if (loading) {
    return <div className={`${frame} animate-pulse ${dark ? 'bg-slate-700/60' : 'bg-surface-3'}`} />
  }

  if (!imageUrl || failed) {
    return (
      <div className={`${frame} flex items-center justify-center ${dark ? 'bg-slate-700 text-slate-300' : 'bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-300'}`}>
        <CarIcon size={iconSize} strokeWidth={1.8} />
      </div>
    )
  }

  return (
    <div className={`${frame} ring-1 ${dark ? 'bg-slate-800 ring-white/10' : 'bg-surface-2 ring-line-soft'}`}>
      <img
        src={imageUrl}
        alt={`${make} ${model}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  )
}
