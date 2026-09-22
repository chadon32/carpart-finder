import { render } from '@testing-library/react-native'
import { ListingCard } from '../ListingCard'
import type { Listing } from '@/api/types'

const listing = (shippingCost: number | null): Listing => ({
  id: 'listing-1',
  title: 'Brake Pads',
  price: 49.99,
  currency: 'USD',
  condition: 'New',
  seller: 'Parts Seller',
  sellerFeedbackPercentage: null,
  image: null,
  link: 'https://example.test/listing-1',
  source: 'Example',
  crossBorder: false,
  shippingCost,
  verifiedFitment: true,
})

async function renderCard(shippingCost: number | null) {
  return await render(
    <ListingCard
      listing={listing(shippingCost)}
      isBestValue={false}
      isCheapest={false}
      isComparing={false}
      onPress={jest.fn()}
      onToggleCompare={jest.fn()}
    />
  )
}

test('accessible listing label includes unavailable shipping information', async () => {
  const screen = await renderCard(null)

  expect(screen.getByRole('button', { name: 'Brake Pads, $49.99. Shipping cost unavailable. Marketplace compatibility match.' })).toBeTruthy()
})

test('accessible listing label includes the known shipping amount', async () => {
  const screen = await renderCard(12.5)

  expect(screen.getByRole('button', { name: 'Brake Pads, $49.99. +$12.50 shipping. Marketplace compatibility match.' })).toBeTruthy()
})

test('accessible listing label explicitly announces free shipping', async () => {
  const screen = await renderCard(0)
  expect(screen.getByRole('button', { name: 'Brake Pads, $49.99. Free shipping. Marketplace compatibility match.' })).toBeTruthy()
})
