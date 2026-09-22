export const ACCOUNT_LIMITS = Object.freeze({
  activeGuestAlertsPerEmail: 5,
  savedSearchesPerUser: 50,
  activePriceAlertsPerUser: 20,
})

export const MAX_ACCESS_TOKEN_LENGTH = 8192
const MAX_EMAIL_LENGTH = 254
const MAX_NAME_LENGTH = 80
const MAX_PASSWORD_LENGTH = 128
const MAX_VEHICLE_FIELD_LENGTH = 60
const MAX_TARGET_PRICE = 1_000_000
function hasControlCharacters(value) {
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function cleanText(value, { label, required = true, max = MAX_VEHICLE_FIELD_LENGTH } = {}) {
  if (typeof value !== 'string') return { error: `${label} is required` }
  const text = value.trim()
  if (required && !text) return { error: `${label} is required` }
  if (hasControlCharacters(text)) return { error: `${label} contains unsupported characters` }
  if (text.length > max) return { error: `${label} is too long` }
  return { value: text }
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || email.length > MAX_EMAIL_LENGTH || hasControlCharacters(email)) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

export function validateAuthInput(body, { signup = false } = {}) {
  const email = normalizeEmail(body?.email)
  if (!email) return { error: 'Enter a valid email address' }
  if (typeof body?.password !== 'string' || body.password.length < 8) {
    return { error: signup ? 'Password must be at least 8 characters' : 'Invalid email or password' }
  }
  if (body.password.length > MAX_PASSWORD_LENGTH || hasControlCharacters(body.password)) {
    return { error: signup ? 'Password must be 128 characters or fewer' : 'Invalid email or password' }
  }

  let name = ''
  if (signup && body?.name != null && body.name !== '') {
    const result = cleanText(body.name, { label: 'Name', required: false, max: MAX_NAME_LENGTH })
    if (result.error) return result
    name = result.value
  }
  return { value: { email, password: body.password, name } }
}

export function validateSavedSearchInput(body) {
  const year = Number(body?.year)
  if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) {
    return { error: 'Enter a valid model year' }
  }

  const values = { year: String(year) }
  for (const field of ['make', 'model', 'part']) {
    const result = cleanText(body?.[field], { label: field[0].toUpperCase() + field.slice(1) })
    if (result.error) return result
    values[field] = result.value
  }

  if (body?.trim != null && body.trim !== '') {
    const trim = cleanText(body.trim, { label: 'Trim', required: false })
    if (trim.error) return trim
    values.trim = trim.value
  } else {
    values.trim = null
  }

  return { value: values }
}

export function validateTargetPrice(value) {
  const price = Number(value)
  if (!Number.isFinite(price) || price <= 0 || price > MAX_TARGET_PRICE) {
    return { error: 'Enter a target price between $0.01 and $1,000,000' }
  }
  return { value: Number(price.toFixed(2)) }
}

export function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function validateAccessToken(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ACCESS_TOKEN_LENGTH
}

export function resolveOAuthRedirectOrigin(env = process.env) {
  const fallback = env.NODE_ENV === 'production'
    ? 'https://carpartsradar.com/'
    : 'http://localhost:5173/'
  const configured = String(env.FRONTEND_URL || '').trim()
  if (!configured) return fallback

  try {
    const url = new URL(configured)
    const protocolAllowed = url.protocol === 'https:'
      || (env.NODE_ENV !== 'production' && url.protocol === 'http:')
    return protocolAllowed ? `${url.origin}/` : fallback
  } catch {
    return fallback
  }
}
