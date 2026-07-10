const VIN_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/

// Returns the first 17-char VIN-shaped token in OCR text, or null. Tries raw
// tokens first, then the text with all whitespace stripped (labels often wrap
// the VIN across lines).
export function extractVin(ocrText: string): string | null {
  const upper = ocrText.toUpperCase()
  for (const token of upper.split(/[^A-Z0-9]+/)) {
    if (VIN_CHARS.test(token)) return token
  }
  const joined = upper.replace(/[^A-Z0-9]+/g, '')
  for (let i = 0; i + 17 <= joined.length; i++) {
    const slice = joined.slice(i, i + 17)
    if (VIN_CHARS.test(slice)) return slice
  }
  return null
}
