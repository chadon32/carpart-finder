import { fetchWithRetry } from './httpClient.js'

const BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles'

const makesCache = new Map()
const modelsCache = new Map()
const makesPromises = new Map()
const modelsPromises = new Map()

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Covers cars, trucks, and SUVs/minivans (MPV). Excludes motorcycles, trailers,
// buses, and other body types NHTSA tracks that aren't relevant to this app.
export const VEHICLE_TYPES = {
  car: 'car',
  suv: 'multipurpose passenger vehicle (mpv)',
  truck: 'truck',
}

async function fetchMakesForType(nhtsaType) {
  const res = await fetchWithRetry(
    `${BASE_URL}/GetMakesForVehicleType/${encodeURIComponent(nhtsaType)}?format=json`,
    {},
    { timeoutMs: 10000, retries: 2 }
  )
  if (!res.ok) throw new Error(`NHTSA makes lookup failed (${res.status})`)
  const data = await res.json()
  return data.Results || []
}

export async function getMakes(type) {
  const cacheKey = type && VEHICLE_TYPES[type] ? type : 'all'
  const cached = makesCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  if (makesPromises.has(cacheKey)) {
    return makesPromises.get(cacheKey)
  }

  const promise = (async () => {
    try {
      const nhtsaTypes = cacheKey === 'all' ? Object.values(VEHICLE_TYPES) : [VEHICLE_TYPES[cacheKey]]
      const results = await Promise.all(nhtsaTypes.map(fetchMakesForType))
      const allResults = results.flat()

      const makes = Array.from(new Set(allResults.map((r) => r.MakeName?.trim()).filter(Boolean))).sort()

      makesCache.set(cacheKey, { data: makes, expiresAt: Date.now() + CACHE_TTL_MS })
      return makes
    } finally {
      makesPromises.delete(cacheKey)
    }
  })()

  makesPromises.set(cacheKey, promise)
  return promise
}

export async function getModels(make, year) {
  const key = `${make.toLowerCase()}::${year}`
  const cached = modelsCache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  if (modelsPromises.has(key)) {
    return modelsPromises.get(key)
  }

  const promise = (async () => {
    try {
      const res = await fetchWithRetry(
        `${BASE_URL}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${encodeURIComponent(year)}?format=json`,
        {},
        { timeoutMs: 10000, retries: 2 }
      )
      if (!res.ok) throw new Error(`NHTSA models lookup failed (${res.status})`)
      const data = await res.json()

      const models = Array.from(
        new Set((data.Results || []).map((r) => r.Model_Name?.trim()).filter(Boolean))
      ).sort()

      modelsCache.set(key, { data: models, expiresAt: Date.now() + CACHE_TTL_MS })
      return models
    } finally {
      modelsPromises.delete(key)
    }
  })()

  modelsPromises.set(key, promise)
  return promise
}
