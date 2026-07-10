import { fetchMakes, searchParts, fetchPrices, identifyPartFromImage, API_BASE } from '../client'

const mockFetch = jest.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => mockFetch.mockReset())

test('fetchMakes hits the production API with the platform header', async () => {
  mockFetch.mockReturnValue(jsonResponse({ makes: ['TOYOTA'] }))
  const res = await fetchMakes('car')
  expect(res.makes).toEqual(['TOYOTA'])
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toBe(`${API_BASE}/api/makes?type=car`)
  expect(init.headers['X-App-Platform']).toBe('ios')
})

test('searchParts builds the query and returns the typed response', async () => {
  mockFetch.mockReturnValue(
    jsonResponse({ query: 'q', results: [], providerErrors: {}, skippedProviders: [] })
  )
  const res = await searchParts('2015', 'Toyota', 'Camry', 'Brake Pads')
  expect(res.results).toEqual([])
  expect(mockFetch.mock.calls[0][0]).toBe(
    `${API_BASE}/api/search?year=2015&make=Toyota&model=Camry&part=Brake+Pads`
  )
})

test('fetchPrices joins ids into one query', async () => {
  mockFetch.mockReturnValue(jsonResponse({ prices: { a: { available: true, price: 9 } } }))
  const res = await fetchPrices(['a', 'b'])
  expect(res.prices.a.price).toBe(9)
  expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/api/prices?ids=a%2Cb`)
})

test('identifyPartFromImage POSTs the photo', async () => {
  mockFetch.mockReturnValue(jsonResponse({ identified: true, partName: 'Brake Pads' }))
  const res = await identifyPartFromImage('b64')
  expect(res.partName).toBe('Brake Pads')
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toBe(`${API_BASE}/api/identify-part`)
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body).image).toBe('b64')
  expect(init.headers['X-App-Platform']).toBe('ios')
})

test('non-OK responses throw the server error message', async () => {
  mockFetch.mockReturnValue(jsonResponse({ error: 'year must be 4 digits' }, false, 400))
  await expect(fetchMakes()).rejects.toThrow('year must be 4 digits')
})
