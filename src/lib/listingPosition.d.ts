export type ListingPosition = 'front' | 'rear' | 'kit'
export function listingPosition(title: unknown): ListingPosition | null
export function isPositionSensitivePart(part: unknown): boolean
export function positionChoices(listings: ReadonlyArray<{ title?: string }> | undefined, part: unknown): ListingPosition[]
