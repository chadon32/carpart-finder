import { fetchMakes, searchParts, API_BASE } from '../client'

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

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

test('non-OK responses throw the server error message', async () => {
  mockFetch.mockReturnValue(jsonResponse({ error: 'year must be 4 digits' }, false, 400))
  await expect(fetchMakes()).rejects.toThrow('year must be 4 digits')
})
