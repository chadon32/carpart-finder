export class FriendlyApiError extends Error {
  status: number
  constructor(message: string, status?: number)
}

export function friendlyApiError(url: string, status?: number, options?: { parseFailed?: boolean }): string

export function readJsonResponse<T>(res: Response, url: string): Promise<T>
