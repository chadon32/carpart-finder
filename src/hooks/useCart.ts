import { useEffect, useState } from 'react'
import type { Listing } from '../api/client'

export type CartItem = Listing & {
  cartId: string
  addedAt: number
  carLabel: string
  part: string
}

const STORAGE_KEY = 'car-part-finder-cart'

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => loadCart())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addItem = (listing: Listing, carLabel: string, part: string) => {
    setItems((prev) => {
      if (prev.some((item) => item.id === listing.id)) return prev
      const cartItem: CartItem = { ...listing, cartId: `${listing.id}-${Date.now()}`, addedAt: Date.now(), carLabel, part }
      return [...prev, cartItem]
    })
  }

  const removeItem = (cartId: string) => {
    setItems((prev) => prev.filter((item) => item.cartId !== cartId))
  }

  const clear = () => setItems([])

  const isInCart = (listingId: string) => items.some((item) => item.id === listingId)

  return { items, addItem, removeItem, clear, isInCart }
}
