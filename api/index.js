// Vercel serverless function entry point. This is the single source of truth
// for the Express app; server/index.js (used for local dev) just imports and
// runs it with app.listen(). All business logic stays in server/*.js so
// nothing had to be duplicated.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { searchCheapestListings } from '../server/search.js'
import { getMakes, getModels } from '../server/nhtsa.js'
import { getTrims } from '../server/ebayCompatibility.js'
import { getCurrentPrices } from '../server/providers/ebay.js'
import { getVehicleImage } from '../server/vehicleImages.js'
import supabaseRoutes from '../server/routes/supabase.js'
import { checkPriceAlerts } from '../server/workers/priceChecker.js'
import { diagnoseSymptom } from '../server/symptoms.js'

const app = express()
app.use(express.json())

// Secure CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL, // e.g. https://yourdomain.com
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  // Security headers
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('X-Frame-Options', 'DENY')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:")
  next()
})

// Behind Vercel's proxy, req.ip is the proxy unless we trust the first
// X-Forwarded-For hop — without this, every visitor shares ONE rate bucket
// and the whole site 429s under light traffic.
app.set('trust proxy', 1)

// Rate-limit only the expensive endpoint (each visitor's search flow makes
// ~5-7 API calls total, so a whole-app 100/15min cap would starve real use).
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/search', searchLimiter)
// Quote runs one provider search per part, so it shares the same budget.
app.use('/api/quote', searchLimiter)

app.get('/api/makes', async (req, res) => {
  try {
    const makes = await getMakes(req.query.type ? String(req.query.type) : undefined)
    res.json({ makes })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Failed to fetch data' })
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
    res.status(502).json({ error: 'Failed to fetch data' })
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
    res.status(502).json({ error: 'Failed to fetch data' })
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
    res.status(502).json({ error: 'Failed to fetch data' })
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
    res.status(502).json({ error: 'Failed to fetch data' })
  }
})

// Supabase-backed routes (accounts, saved searches, price alerts)
app.use('/api/supabase', supabaseRoutes)

// Vercel Cron target (see vercel.json "crons"). Vercel sends
// "Authorization: Bearer ${CRON_SECRET}" when that env var is set; reject
// everything else so random visitors can't burn eBay quota on demand.
app.get('/api/cron/check-alerts', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const result = await checkPriceAlerts()
    res.json(result)
  } catch (err) {
    console.error('[Cron] check-alerts failed:', err)
    res.status(500).json({ error: 'Price check failed' })
  }
})

// Free-text symptom → likely parts. Pure local keyword matching against a
// curated knowledge base (server/symptoms.js) — instant, no external calls.
app.get('/api/diagnose', (req, res) => {
  const symptom = String(req.query.symptom || '').trim()
  if (!symptom) {
    return res.status(400).json({ error: 'symptom query param is required' })
  }
  res.json({ matches: diagnoseSymptom(symptom) })
})

// The cheapest raw search hit is often an accessory (a $7 "rotor screw" for a
// "Brake Rotors" search), so a quote that auto-picks one listing must check
// the title actually names the part. Tokens match by prefix so "pad" ≈ "pads".
const QUOTE_STOPWORDS = new Set(['and', 'the', 'of', 'for', 'with', 'kit', 'set'])
const QUOTE_ACCESSORY_WORDS = [
  'screw', 'bolt', 'clip', 'pin', 'washer', 'retainer', 'grommet', 'bracket',
  'decal', 'sticker', 'emblem', 'shim', 'grease', 'cleaner', 'paint', 'tool',
  'gauge', 'sensor', 'switch', 'connector', 'wire', 'harness', 'relay', 'fuse', 'cap',
  // Novelty/cosmetic add-ons and damaged goods that undercut real parts
  'cover', 'universal', 'pedal', 'defect', 'damaged', 'broken', 'cracked',
]

function pickListingForPart(results, part) {
  const partTokens = part
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !QUOTE_STOPWORDS.has(t))
    .map((t) => t.replace(/s$/, ''))
  if (partTokens.length === 0) return results[0] || null

  // All tokens must appear for short names; allow one miss for longer ones
  // ("Sway Bar End Links" should still match a "Sway Bar Link" title).
  const required = partTokens.length >= 3 ? partTokens.length - 1 : partTokens.length
  // Accessory words only disqualify a title when they're not part of what was
  // asked for (an "Oxygen Sensor" quote may of course contain "sensor").
  const blocked = QUOTE_ACCESSORY_WORDS.filter((w) => !partTokens.some((t) => t.startsWith(w) || w.startsWith(t)))

  const candidates = results.filter((r) => {
    // Never quote broken/for-parts listings, however cheap.
    if (/parts only|not working/i.test(r.condition || '')) return false
    const titleTokens = r.title.toLowerCase().split(/[^a-z0-9]+/).map((t) => t.replace(/s$/, ''))
    const hits = partTokens.filter((pt) => titleTokens.some((tt) => tt.startsWith(pt))).length
    if (hits < required) return false
    return !titleTokens.some((tt) => blocked.includes(tt))
  })

  if (candidates.length === 0) return null
  // Prefer listings eBay's compatibility engine verified for this exact
  // vehicle; only fall back to unverified keyword matches when there are none.
  const verified = candidates.filter((r) => r.verifiedFitment !== false)
  const pool = verified.length > 0 ? verified : candidates
  return pool.reduce((best, r) => {
    const total = r.price + (r.shippingCost || 0)
    return total < best.total ? { total, listing: r } : best
  }, { total: Infinity, listing: null }).listing
}

// Price a list of parts for one vehicle: cheapest fitting listing per part
// (by price + shipping, matching how the results UI ranks value) plus totals.
app.get('/api/quote', async (req, res) => {
  const { year, make, model, trim, zip } = req.query
  const parts = String(req.query.parts || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 6)

  if (!year || !make || !model || parts.length === 0) {
    return res.status(400).json({ error: 'year, make, model, and parts query params are required' })
  }
  const cleanZip = zip && /^\d{5}$/.test(String(zip)) ? String(zip) : undefined

  try {
    const items = await Promise.all(
      parts.map(async (part) => {
        try {
          const { results } = await searchCheapestListings({
            year: String(year),
            make: String(make),
            model: String(model),
            trim: trim ? String(trim) : undefined,
            part,
            zip: cleanZip,
            // Take the provider's full page (eBay returns 50 per call no
            // matter what): the relevance filter below discards cheap
            // accessory listings (screw kits, covers), so we want the
            // deepest candidate pool the same single API call can give.
            limit: 50,
            // Best Match ranking: a price-ascending page for parts like
            // rotors is 100% screw kits — real parts never appear at all.
            sort: 'relevance',
          })
          return { part, listing: pickListingForPart(results, part) }
        } catch {
          return { part, listing: null, error: true }
        }
      })
    )

    const priced = items.filter((i) => i.listing)
    const subtotal = priced.reduce((s, i) => s + i.listing.price, 0)
    const shipping = priced.reduce((s, i) => s + (i.listing.shippingCost || 0), 0)

    res.json({
      items,
      subtotal: Number(subtotal.toFixed(2)),
      shipping: Number(shipping.toFixed(2)),
      total: Number((subtotal + shipping).toFixed(2)),
      currency: 'USD',
    })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Failed to fetch data' })
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
    res.status(502).json({ error: 'Failed to fetch data' })
  }
})

export default app
