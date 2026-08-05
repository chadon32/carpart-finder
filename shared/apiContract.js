// Increment this whenever the frontend's safety assumptions require a newer
// API response shape. Clients fail closed when an older server omits or reports
// a different value, preventing stale deployments from presenting unsafe data.
export const FITMENT_CONTRACT_VERSION = 2
export const API_RELEASE = '2026-07-30.1'

export function assertFitmentContract(payload) {
  if (payload?.fitmentContractVersion !== FITMENT_CONTRACT_VERSION) {
    const error = new Error(
      'The search service is out of date. Restart or redeploy the API, then try again.'
    )
    error.name = 'ApiContractError'
    error.code = 'FITMENT_CONTRACT_MISMATCH'
    throw error
  }
  return payload
}
