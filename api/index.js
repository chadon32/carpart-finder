// Vercel serverless function entry point. This is the single source of truth
// for the Express app; server/index.js (used for local dev) just imports and
// runs it with app.listen(). All business logic stays in server/*.js so
// nothing had to be duplicated.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { searchCheapestListings } from '../server/search.js'
import { getMakes, getModels, decodeVin } from '../server/nhtsa.js'
import { getTrims } from '../server/ebayCompatibility.js'
import { getCurrentPrices } from '../server/providers/ebay.js'
import { getVehicleImage } from '../server/vehicleImages.js'
import { getRecalls } from '../server/recalls.js'
import supabaseRoutes from '../server/routes/supabase.js'
import { checkPriceAlerts } from '../server/workers/priceChecker.js'
import { recordPriceObservation } from '../server/priceHistory.js'
import { diagnoseSymptom } from '../server/symptoms.js'
import { generateRepairGuide } from '../server/routes/ai.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const app = express()
// 100kb is fine for every JSON body except the AI photo-identify endpoint,
// whose base64 image (client-downscaled to ~1024px JPEG) can land higher.
// 2mb comfortably covers that while still well under Vercel's serverless
// request-body ceiling (~4.5mb) and rate-limiting oversized abuse.
app.use(express.json({ limit: '2mb' }))

// Secure CORS configuration. The production domains are hardcoded rather
// than relying solely on FRONTEND_URL: the site now serves on both the apex
// (carpartsradar.com, primary) and www (redirects to apex), and a single
// misconfigured/missing env var would otherwise CORS-reject every real
// browser request (POST/DELETE always sends an Origin header, even
// same-origin) — silently breaking login, signup, saved searches, and price
// alerts in production while looking fine from curl (no Origin) or from
// localhost (hardcoded below).
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://carpartsradar.com',
  'https://www.carpartsradar.com',
  process.env.FRONTEND_URL, // extra override, e.g. a staging domain
].filter(Boolean)

// Dev-only convenience: allow LAN origins so a phone on the same network can
// hit the dev server. Never true in production.
function isDevLanOrigin(origin) {
  return (
    process.env.NODE_ENV !== 'production' &&
    (origin.startsWith('http://192.168.') || origin.startsWith('http://10.'))
  )
}

function isAllowedOrigin(origin) {
  return allowedOrigins.includes(origin) || isDevLanOrigin(origin)
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    if (isAllowedOrigin(origin)) return callback(null, true)

    // Do NOT throw: an Error here reaches the error handler as an opaque 500.
    // Signal "not allowed" and let the guard below turn it into an honest 403.
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// cors() omits the CORS headers for a disallowed origin but still calls next().
// A browser would block reading the response, but a non-browser client would
// not — so reject the request outright rather than serving it.
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }
  next()
})

app.use((_req, res, next) => {
  // JSON API responses: never cache, never sniff. The document-level policy
  // (CSP, HSTS, X-Frame-Options, Referrer-Policy) now lives in vercel.json,
  // because those headers do nothing on an API response — only the HTML
  // document enforces them, and the document is served by Vercel's static
  // host, which never ran this middleware.
  res.set('Cache-Control', 'no-store')
  res.set('X-Content-Type-Options', 'nosniff')
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
// Prices makes one eBay item lookup per requested id, so it does too.
app.use('/api/prices', searchLimiter)

// The AI endpoints each hit Gemini (paid, with hard quotas) and are the most
// expensive per call, so they get a much tighter, dedicated budget. Without
// this, a single scripted client could run up the AI bill or exhaust the
// shared quota for every other user. 20 per 15 min is generous for a genuine
// user (who identifies a part or reads a guide occasionally) but shuts down
// automated abuse.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests, please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/identify-part', aiLimiter)
app.use('/api/ai', aiLimiter)

// The account surface had NO rate limiting at all: unlimited password
// brute-force against /login, unlimited account creation via /signup, and
// unlimited unauthenticated row insertion via the public subscribe endpoint.
// Order matters — the narrowest paths mount first, so a login attempt is
// charged to authLimiter rather than the general write budget.
//
// Successes are counted alongside failures. That costs a legitimate user
// nothing (they log in once) and denies an attacker cheap confirmation once
// they find a valid credential.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Guest alert subscription is public and writes a database row. Tighter still.
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many alert subscriptions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/supabase/login', authLimiter)
app.use('/api/supabase/signup', authLimiter)
app.use('/api/supabase/price-alerts/subscribe', subscribeLimiter)
app.use('/api/supabase', writeLimiter)

// A model year is 4 digits from 1980 to next year; make/model must be non-empty
// and sanely short. Rejecting junk up front avoids burning rate-limited eBay
// calls on garbage like `year=abc&model=;DROP` and keeps NHTSA lookups clean.
const MAX_VEHICLE_FIELD = 60
function validateYear(year) {
  const y = Number(year)
  return Number.isInteger(y) && y >= 1980 && y <= new Date().getFullYear() + 1
}
// Returns an error string, or null when the vehicle fields are acceptable.
function vehicleError({ year, make, model, trim, part }) {
  if (!validateYear(year)) return 'A valid model year (1980–present) is required'
  const fields = { make, model, trim, part }
  const required = ['make', 'model']
  for (const [label, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const s = String(value).trim()
    if (required.includes(label) && !s) return `${label} is required`
    if (s.length > MAX_VEHICLE_FIELD) return `${label} is too long`
  }
  return null
}

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
  if (!validateYear(year)) {
    return res.status(400).json({ error: 'A valid model year (1980–present) is required' })
  }
  try {
    const models = await getModels(String(make), String(year))
    res.json({ models })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Failed to fetch data' })
  }
})

// 17 chars; letters I, O, Q are never used in a VIN (avoids 0/1 confusion).
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i

app.get('/api/vin', async (req, res) => {
  const vin = String(req.query.vin || '').trim()
  if (!VIN_RE.test(vin)) {
    return res.status(400).json({ error: 'A 17-character VIN is required (the letters I, O, and Q never appear in a VIN)' })
  }
  try {
    const decoded = await decodeVin(vin)
    // vPIC answers 200 even for VINs it can't resolve; an unusable decode is a
    // client-visible condition, not fabricated fallback data.
    if (!decoded.year || !decoded.make || !decoded.model) {
      return res.status(422).json({ error: "Couldn't decode that VIN — try picking your vehicle manually" })
    }
    res.json(decoded)
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Failed to fetch data' })
  }
})

// One outbound eBay call is made per id, so this list must be bounded. Without
// a cap, `?ids=a,b,c,...` with thousands of entries turned one unauthenticated
// GET into thousands of concurrent upstream requests.
const MAX_PRICE_IDS = 20

app.get('/api/prices', async (req, res) => {
  const ids = req.query.ids ? String(req.query.ids).split(',').filter(Boolean) : []
  if (ids.length === 0) {
    return res.status(400).json({ error: 'ids query param is required' })
  }
  if (ids.length > MAX_PRICE_IDS) {
    return res.status(400).json({ error: `A maximum of ${MAX_PRICE_IDS} ids may be requested at once` })
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

app.post('/api/ai/repair-guide', generateRepairGuide)

app.get('/api/trims', async (req, res) => {
  const { year, make, model } = req.query
  const invalid = vehicleError({ year, make, model })
  if (invalid) {
    return res.status(400).json({ error: invalid })
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
  const { make, model, year } = req.query
  if (!make || !model) {
    return res.status(400).json({ error: 'make and model query params are required' })
  }
  // make/model become cache keys and upstream Wikipedia queries — bound them.
  // vehicleError() isn't reused directly here: it requires a year, and year is
  // optional on this route.
  for (const [label, value] of Object.entries({ make, model })) {
    if (String(value).trim().length > MAX_VEHICLE_FIELD) {
      return res.status(400).json({ error: `${label} is too long` })
    }
  }
  if (year && !validateYear(year)) {
    return res.status(400).json({ error: 'A valid model year (1980–present) is required' })
  }
  try {
    const imageUrl = await getVehicleImage(String(make), String(model), year ? String(year) : undefined)
    // This is stable reference data (a model's stock photo), so let the
    // browser cache it too, unlike the no-store default for live listings.
    res.set('Cache-Control', 'public, max-age=86400')
    res.json({ imageUrl })
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Failed to fetch data' })
  }
})

app.get('/api/recalls', async (req, res) => {
  const { year, make, model } = req.query
  const invalid = vehicleError({ year, make, model })
  if (invalid) {
    return res.status(400).json({ error: invalid })
  }
  try {
    const recalls = await getRecalls(String(make), String(model), String(year))
    // Recall campaigns are stable reference data — let the browser cache too.
    res.set('Cache-Control', 'public, max-age=86400')
    res.json({ recalls })
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
  // ("Sway Bar End Links" should still match a "Sway Bar Link" title). Cap the
  // requirement so a long free-text part name ("Front Left Lower Control Arm
  // with Ball Joint Assembly") doesn't demand so many token hits that every
  // real listing is filtered out.
  const base = partTokens.length >= 3 ? partTokens.length - 1 : partTokens.length
  const required = Math.min(base, 4)
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

  if (parts.length === 0) {
    return res.status(400).json({ error: 'parts query param is required' })
  }
  const invalid = vehicleError({ year, make, model, trim })
  if (invalid) {
    return res.status(400).json({ error: invalid })
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

app.post('/api/identify-part', async (req, res) => {
  const { image } = req.body
  if (!image) {
    return res.status(400).json({ error: 'image body param is required' })
  }
  
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key is not configured' })
    }

    const match = image.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,(.+)$/)
    if (!match) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 Data URL.' })
    }
    const mimeType = match[1]
    const base64Data = match[2]

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    // First, try the fast, cheap Flash model.
    const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = "You are an expert automotive mechanic. Identify the car part in this image. Return ONLY the exact, standard name of the part in Title Case. Do not include any other text, descriptions, or punctuation. If you cannot clearly identify the part or are unsure, you MUST return exactly the word 'UNKNOWN'."

    const result = await flashModel.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType } }
    ])
    let partName = result.response.text().trim().replace(/['"]/g, '')

    // If Flash is unsure, escalate to the Pro model — but isolate it: a Pro
    // quota/availability error must NOT fail the whole request. We simply fall
    // back to "unidentified" instead of surfacing a 500 to the user.
    if (partName.toUpperCase() === 'UNKNOWN') {
      try {
        const proModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })
        const proPrompt = "You are an expert automotive mechanic analyzing a difficult, dirty, or obscured image. Identify the car part in this image. Return ONLY the exact, standard name of the part in Title Case. Do not include any other text. If you still cannot identify it, return exactly the word 'UNKNOWN'."
        const proResult = await proModel.generateContent([
          proPrompt,
          { inlineData: { data: base64Data, mimeType } }
        ])
        partName = proResult.response.text().trim().replace(/['"]/g, '')
      } catch (proErr) {
        console.warn('[AI] Pro escalation unavailable, falling back to unidentified:', proErr?.message)
      }
    }

    // Honest response: report whether we actually identified anything rather
    // than fabricating a confidence score. Empty/UNKNOWN -> not identified.
    const identified = Boolean(partName) && partName.toUpperCase() !== 'UNKNOWN'
    res.json({ identified, partName: identified ? partName : null })
  } catch (err) {
    console.error('[AI] identify-part failed:', err?.message)
    res.status(502).json({ error: 'The part identifier is temporarily unavailable. Please try again shortly.' })
  }
})

app.get('/api/search', async (req, res) => {
  const { year, make, model, part, trim, zip } = req.query
  if (!part || !String(part).trim()) {
    return res.status(400).json({ error: 'part query param is required' })
  }
  const invalid = vehicleError({ year, make, model, trim, part })
  if (invalid) {
    return res.status(400).json({ error: invalid })
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
    // Record the day's observed low from genuinely live results only (cache
    // hits re-observe nothing; stale results are old data). Awaited because
    // Vercel can freeze the function right after res.json; recordPriceObservation
    // never throws, so this cannot fail the search.
    if (!result.cached && !result.stale && result.results.length > 0) {
      const cheapestTotal = result.results.reduce(
        (best, r) => Math.min(best, r.price + (r.shippingCost || 0)),
        Infinity
      )
      await recordPriceObservation({ year, make, model, part, total: cheapestTotal })
    }
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Failed to fetch data' })
  }
})

// Anything reaching here matched no route. Return JSON, not Express's HTML.
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Terminal error handler. Express identifies it by its four-argument arity —
// do not remove `next` even though it is unused. Without this, express.json()'s
// SyntaxError on a malformed body falls through to Express's default handler,
// which replies with an HTML page (and a stack trace outside production).
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Malformed JSON body' })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' })
  }
  // Log the detail; return none of it.
  console.error('[api] Unhandled error:', err?.message, err?.stack)
  res.status(500).json({ error: 'Something went wrong' })
})

export default app
