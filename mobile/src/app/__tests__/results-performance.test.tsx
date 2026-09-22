import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import type { SearchResponse } from '@/api/types'
import { usePrefs } from '@/stores/prefs'
import Results from '../results'

const mockSearchParts = jest.fn()
const mockFetchPriceHistory = jest.fn()

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({
    year: '2020',
    make: 'Honda',
    model: 'Civic',
    trim: 'Sport',
    part: 'Brake Pads',
  }),
}))

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }))

jest.mock('@/api/client', () => ({
  searchParts: (...args: unknown[]) => mockSearchParts(...args),
  fetchPriceHistory: (...args: unknown[]) => mockFetchPriceHistory(...args),
}))

const emptyResponse: SearchResponse = {
  fitmentContractVersion: 2,
  query: '2020 Honda Civic Sport Brake Pads',
  results: [],
  fallbackResults: [],
  providerErrors: {},
  skippedProviders: [],
}

beforeEach(() => {
  mockSearchParts.mockReset()
  mockFetchPriceHistory.mockReset()
  usePrefs.setState({ zip: '', hydrated: true })
  mockFetchPriceHistory.mockResolvedValue({ observations: [] })
})

function listingResponse(title: string): SearchResponse {
  return {
    ...emptyResponse,
    results: [{
      id: title, title, price: 25, currency: 'USD', condition: 'New',
      seller: 'Test seller', sellerFeedbackPercentage: '99', image: null,
      link: 'https://example.com/listing', source: 'eBay', crossBorder: false,
      shippingCost: 5, verifiedFitment: true,
    }],
  }
}

test('hides previous ZIP estimates while a new ZIP is pending and when that search fails', async () => {
  let rejectNewSearch!: (error: Error) => void
  mockSearchParts.mockResolvedValueOnce(listingResponse('Previous ZIP listing'))
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectNewSearch = reject }))
  const screen = await render(<Results />)
  await waitFor(() => expect(screen.getByText('Previous ZIP listing')).toBeTruthy())

  await act(() => usePrefs.getState().setZip('90210'))
  await waitFor(() => expect(mockSearchParts).toHaveBeenCalledTimes(2))
  expect(screen.queryByText('Previous ZIP listing')).toBeNull()
  expect(screen.getByText('SCANNING LIVE LISTINGS')).toBeTruthy()

  await act(async () => { rejectNewSearch(new Error('Network unavailable')) })
  await waitFor(() => expect(screen.getByText("Couldn't reach the search service")).toBeTruthy())
  expect(screen.queryByText('Previous ZIP listing')).toBeNull()
  expect(screen.queryByText('Live search failed — showing recent results')).toBeNull()
  await screen.unmount()
})

test('keeps same-search results with an honest stale warning when refresh fails', async () => {
  mockSearchParts.mockResolvedValueOnce(listingResponse('Current ZIP listing'))
    .mockRejectedValueOnce(new Error('Network unavailable'))
  const screen = await render(<Results />)
  await waitFor(() => expect(screen.getByText('Current ZIP listing')).toBeTruthy())

  await fireEvent(screen.getByLabelText('Search results'), 'refresh')

  expect(screen.getByText('Current ZIP listing')).toBeTruthy()
  expect(screen.getByText('Live search failed — showing recent results')).toBeTruthy()
  await screen.unmount()
})

test('ignores out-of-order responses even if the obsolete request does not honor abort', async () => {
  const resolvers: ((response: SearchResponse) => void)[] = []
  mockSearchParts.mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve) }))
  const screen = await render(<Results />)
  await waitFor(() => expect(resolvers).toHaveLength(1))
  await act(() => usePrefs.getState().setZip('90210'))
  await waitFor(() => expect(resolvers).toHaveLength(2))

  await act(async () => { resolvers[1](listingResponse('Newest ZIP listing')) })
  await waitFor(() => expect(screen.getByText('Newest ZIP listing')).toBeTruthy())
  await act(async () => { resolvers[0](listingResponse('Obsolete ZIP listing')) })
  expect(screen.getByText('Newest ZIP listing')).toBeTruthy()
  expect(screen.queryByText('Obsolete ZIP listing')).toBeNull()
  expect(mockFetchPriceHistory).toHaveBeenCalledTimes(1)
  await screen.unmount()
})

test('ignores price history from an obsolete search even if abort is not honored', async () => {
  let resolveOldHistory!: (value: { observations: { date: string; price: number }[] }) => void
  mockSearchParts.mockResolvedValue(listingResponse('Current listing'))
  mockFetchPriceHistory.mockImplementationOnce(() => new Promise((resolve) => { resolveOldHistory = resolve }))
    .mockResolvedValueOnce({ observations: [] })
  const screen = await render(<Results />)
  await waitFor(() => expect(mockFetchPriceHistory).toHaveBeenCalledTimes(1))
  await act(() => usePrefs.getState().setZip('90210'))
  await waitFor(() => expect(mockFetchPriceHistory).toHaveBeenCalledTimes(2))

  await act(async () => {
    resolveOldHistory({ observations: Array.from({ length: 5 }, (_, i) => ({ date: `2026-09-0${i + 1}`, price: 99 })) })
  })
  expect(screen.queryByText('PRICE HISTORY (5 DAYS)')).toBeNull()
  await screen.unmount()
})

test('defers price history until the live search response has committed', async () => {
  let resolveSearch!: (response: SearchResponse) => void
  mockSearchParts.mockReturnValue(new Promise((resolve) => {
    resolveSearch = resolve
  }))

  const screen = await render(<Results />)
  await waitFor(() => expect(mockSearchParts).toHaveBeenCalledTimes(1))
  expect(mockFetchPriceHistory).not.toHaveBeenCalled()

  await act(async () => {
    resolveSearch(emptyResponse)
    await Promise.resolve()
  })

  await waitFor(() => expect(mockFetchPriceHistory).toHaveBeenCalledTimes(1))
  await screen.unmount()
})

test('aborts an obsolete search before starting one for a changed ZIP', async () => {
  mockSearchParts.mockImplementation((...args: unknown[]) => {
    const signal = args[6] as AbortSignal
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        const error = new Error('Aborted')
        error.name = 'AbortError'
        reject(error)
      }, { once: true })
    })
  })

  const screen = await render(<Results />)
  await waitFor(() => expect(mockSearchParts).toHaveBeenCalledTimes(1))
  const firstSignal = mockSearchParts.mock.calls[0][6] as AbortSignal

  await act(() => usePrefs.getState().setZip('90210'))

  await waitFor(() => expect(mockSearchParts).toHaveBeenCalledTimes(2))
  expect(firstSignal.aborted).toBe(true)
  expect(mockSearchParts.mock.calls[1][5]).toBe('90210')
  await screen.unmount()
})
