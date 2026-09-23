export const FITMENT_CONTRACT_VERSION: 2
export const API_RELEASE: string

export function assertFitmentContract<T extends { fitmentContractVersion?: number }>(
  payload: T
): T & { fitmentContractVersion: 2 }
