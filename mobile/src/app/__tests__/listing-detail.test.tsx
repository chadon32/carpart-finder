import { fireEvent, render } from '@testing-library/react-native'
import ListingDetail from '../listing-detail'

let mockParams: Record<string, string> = {}

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}))

const validListing = {
  id: 'listing-1',
  title: 'Brake Pads',
  price: 49.99,
  currency: 'USD',
  condition: 'New',
  seller: 'Parts Seller',
  sellerFeedbackPercentage: '99.5',
  image: null,
  link: 'https://www.ebay.com/itm/123',
  source: 'eBay',
  crossBorder: false,
}

const validRoute = () => ({
  listing: JSON.stringify(validListing),
  carLabel: '2020 Honda Civic',
  year: '2020',
  make: 'Honda',
  model: 'Civic',
  part: 'Brake Pads',
})

beforeEach(() => {
  mockParams = {}
  jest.clearAllMocks()
})

test('renders a recoverable unavailable state for malformed deep links', async () => {
  mockParams = { ...validRoute(), listing: '{not json' }

  const screen = await render(<ListingDetail />)

  expect(screen.getByText('Listing unavailable')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Go back to listings'))
  expect(require('expo-router').router.back).toHaveBeenCalledTimes(1)
})

test('renders the same recovery state for incomplete listing route data', async () => {
  mockParams = { ...validRoute(), listing: JSON.stringify({ ...validListing, price: '49.99' }) }

  const screen = await render(<ListingDetail />)

  expect(screen.getByText('Listing unavailable')).toBeTruthy()
})
