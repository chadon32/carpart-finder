// Vercel serverless function entry point. This is the single source of truth
// for the Express app; server/index.js (used for local dev) just imports and
// runs it with app.listen(). All business logic stays in server/*.js so
// nothing had to be duplicated.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { searchCheapestListings } from '../server/search.js'
import { getMakes, getModels } from '../server/nhtsa.js'
import { getTrims } from '../server/ebayCompatibility.js'
import { getCurrentPrices } from '../server/providers/ebay.js'
import { getVehicleImage } from '../server/vehicleImages.js'

const app = express()

app.use(cors())
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

app.get('/api/makes', async (req, res) => {
  try {
    const makes = await getMakes(req.query.type ? String(req.query.type) : undefined)
    res.json({ makes })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/models', async (req, res) => {
  const { make, year } = req.query
  if (!make || !year) {
    return res.status(400).json({ error: 'make and year query params are required' })
  }
  try {
    const models = await getModels(String(make), String(year))
    res.json({ models })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/prices', async (req, res) => {
  const ids = req.query.ids ? String(req.query.ids).split(',').filter(Boolean) : []
  if (ids.length === 0) {
    return res.status(400).json({ error: 'ids query param is required' })
  }
  try {
    // Only eBay items can be re-checked; ignore other sources' ids gracefully.
    const ebayIds = ids.filter((id) => id.startsWith('ebay-'))
    const prices = ebayIds.length ? await getCurrentPrices(ebayIds) : {}
    res.json({ prices })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/trims', async (req, res) => {
  const { year, make, model } = req.query
  if (!year || !make || !model) {
    return res.status(400).json({ error: 'year, make, and model query params are required' })
  }
  try {
    const trims = await getTrims(String(year), String(make), String(model))
    res.json({ trims })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/vehicle-image', async (req, res) => {
  const { make, model } = req.query
  if (!make || !model) {
    return res.status(400).json({ error: 'make and model query params are required' })
  }
  try {
    const imageUrl = await getVehicleImage(String(make), String(model))
    // This is stable reference data (a model's stock photo), so let the
    // browser cache it too, unlike the no-store default for live listings.
    res.set('Cache-Control', 'public, max-age=86400')
    res.json({ imageUrl })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/search', async (req, res) => {
  const { year, make, model, part, trim, zip } = req.query
  if (!year || !make || !model || !part) {
    return res.status(400).json({ error: 'year, make, model, and part query params are required' })
  }
  // Only accept a clean 5-digit US ZIP; ignore anything else.
  const cleanZip = zip && /^\d{5}$/.test(String(zip)) ? String(zip) : undefined
  try {
    const result = await searchCheapestListings({
      year: String(year),
      make: String(make),
      model: String(model),
      trim: trim ? String(trim) : undefined,
      part: String(part),
      zip: cleanZip,
    })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: err.message })
  }
})

export default app
