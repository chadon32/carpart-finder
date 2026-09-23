const EARLIEST_SUPPORTED_YEAR = 1980

export function vehicleYears(currentYear = new Date().getFullYear()) {
  const newestModelYear = currentYear + 1
  return Array.from(
    { length: newestModelYear - EARLIEST_SUPPORTED_YEAR + 1 },
    (_, index) => String(newestModelYear - index)
  )
}
