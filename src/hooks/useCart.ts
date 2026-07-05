import { useEffect, useState } from 'react'
import type { Listing } from '../api/client'

export type CartItem = Listing & {
  cartId: string
  addedAt: number
  carLabel: string
  part: string
}

function getStorageKey(userEmail?: string): string {
  const cleanEmail = userEmail ? userEmail.replace(/[^a-zA-Z0-9]/g, '_') : 'guest'
  return `car-part-finder-cart-${cleanEmail}`
}

function loadCart(userEmail?: string): CartItem[] {
  try {
    const key = getStorageKey(userEmail)
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useCart(userEmail?: string) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart(userEmail))

  // Refresh cart list when active user changes (e.g. login/logout)
  useEffect(() => {
    setItems(loadCart(userEmail))
  }, [userEmail])

  // Save changes whenever items list or user changes
  useEffect(() => {
    const key = getStorageKey(userEmail)
    localStorage.setItem(key, JSON.stringify(items))
  }, [items, userEmail])

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
