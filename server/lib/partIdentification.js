const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export const MAX_IDENTIFICATION_IMAGE_BYTES = 1_500_000

function hasExpectedImageSignature(bytes, mimeType) {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    if (bytes.length < 12 || bytes.subarray(4, 8).toString('ascii') !== 'ftyp') return false
    const brand = bytes.subarray(8, 12).toString('ascii')
    return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)
  }
  return false
}

export function parseIdentificationImage(value) {
  if (typeof value !== 'string') {
    throw new Error('Image must be a base64 data URL')
  }

  const match = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i)
  if (!match) throw new Error('Invalid image format. Use a JPEG, PNG, WebP, HEIC, or HEIF image.')

  const mimeType = match[1].toLowerCase()
  const base64Data = match[2]
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error('Unsupported image type. Use JPEG, PNG, WebP, HEIC, or HEIF.')
  }

  if (base64Data.length > Math.ceil(MAX_IDENTIFICATION_IMAGE_BYTES / 3) * 4 + 4) {
    throw new Error('Image is too large. Choose a smaller or more tightly cropped photo.')
  }

  const decoded = Buffer.from(base64Data, 'base64')
  const canonical = decoded.toString('base64').replace(/=+$/, '')
  if (!decoded.length || decoded.length > MAX_IDENTIFICATION_IMAGE_BYTES || canonical !== base64Data.replace(/=+$/, '')) {
    throw new Error('Image data is invalid or too large.')
  }
  if (!hasExpectedImageSignature(decoded, mimeType)) {
    throw new Error('Image contents do not match the selected image type.')
  }

  return { mimeType, base64Data }
}

export function sanitizeIdentifiedPartName(value) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) return null
  const name = value.trim().replace(/^['"]|['"]$/g, '').trim()
  if (!name || name.toUpperCase() === 'UNKNOWN' || name.length > 60) return null
  if (!/^[A-Za-z0-9][A-Za-z0-9 &()/'-]*$/.test(name)) return null
  if (name.split(/\s+/).length > 8) return null
  if (/\b(?:ignore|instruction|prompt|click|visit|http|www)\b/i.test(name)) return null
  return name
}
