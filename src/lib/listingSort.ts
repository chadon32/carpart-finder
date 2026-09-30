export type SortKey = 'total' | 'value' | 'price' | 'rating'

// One list for the desktop select and the phone sheet, so they cannot drift.
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'total', label: 'Lowest total (with shipping)' },
  { value: 'price', label: 'Lowest item price' },
  { value: 'value', label: 'Best value estimate' },
  { value: 'rating', label: 'Seller rating' },
]
