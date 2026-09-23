export function canStartAccountDeletion(input: {
  confirmation: string
  deleting: boolean
  started: boolean
}): boolean

export function accountDeletionRequiresReauthentication(error: unknown): boolean

export function isRequiredAccountDeletionEmail(
  email: string,
  requiredEmail: string | null | undefined
): boolean

export function accountDeletionErrorMessage(error: {
  status?: number
  message?: string
} | null | undefined): string
