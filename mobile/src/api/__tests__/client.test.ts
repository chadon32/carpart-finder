import {
  fetchMakes,
  fetchRecalls,
  fetchRepairGuide,
  searchParts,
  fetchPrices,
  identifyPartFromImage,
  deleteAccount,
  getAccountDeletionStatus,
  prepareAccountDeletion,
  fetchQuote,
  API_BASE,
} from '../client'

const mockFetch = jest.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => mockFetch.mockReset())
afterEach(() => jest.useRealTimers())

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
    jsonResponse({ fitmentContractVersion: 2, query: 'q', results: [], providerErrors: {}, skippedProviders: [] })
  )
  const res = await searchParts('2015', 'Toyota', 'Camry', 'Brake Pads')
  expect(res.results).toEqual([])
  expect(mockFetch.mock.calls[0][0]).toBe(
    `${API_BASE}/api/search?year=2015&make=Toyota&model=Camry&part=Brake+Pads`
  )
})

test('searchParts passes trim and zip when provided', async () => {
  mockFetch.mockReturnValue(
    jsonResponse({ fitmentContractVersion: 2, query: 'q', results: [], providerErrors: {}, skippedProviders: [] })
  )
  await searchParts('2015', 'Toyota', 'Camry', 'Brake Pads', 'LE', '90210')
  expect(mockFetch.mock.calls[0][0]).toBe(
    `${API_BASE}/api/search?year=2015&make=Toyota&model=Camry&part=Brake+Pads&trim=LE&zip=90210`
  )
})

test('searchParts aborts the network request when its caller cancels', async () => {
  mockFetch.mockImplementation((_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('Aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
  )
  const controller = new AbortController()

  const request = searchParts(
    '2015',
    'Toyota',
    'Camry',
    'Brake Pads',
    undefined,
    undefined,
    controller.signal
  )
  controller.abort()

  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true)
})

test('fetchPrices joins ids into one query', async () => {
  mockFetch.mockReturnValue(jsonResponse({ prices: { a: { available: true, price: 9 } } }))
  const res = await fetchPrices(['a', 'b'])
  expect(res.prices.a.price).toBe(9)
  expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/api/prices?ids=a%2Cb`)
})

test('fetchRecalls accepts an empty lookup but rejects malformed recall fields', async () => {
  mockFetch.mockReturnValueOnce(jsonResponse({ recalls: [] }))
  await expect(fetchRecalls('2020', 'Toyota', 'Camry')).resolves.toEqual({ recalls: [] })
  mockFetch.mockReturnValueOnce(jsonResponse({ recalls: [{ component: { invalid: true } }] }))
  await expect(fetchRecalls('2020', 'Toyota', 'Camry')).rejects.toThrow(/unreadable/i)
})

test('fetchRecalls aborts its request when the screen loses focus', async () => {
  mockFetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      reject(error)
    })
  }))
  const controller = new AbortController()
  const request = fetchRecalls('2020', 'Toyota', 'Camry', controller.signal)
  controller.abort()
  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true)
})

test('searchParts fails closed on an incompatible fitment contract', async () => {
  mockFetch.mockReturnValue(
    jsonResponse({ fitmentContractVersion: 1, query: 'q', results: [], providerErrors: {}, skippedProviders: [] })
  )
  await expect(searchParts('2015', 'Toyota', 'Camry', 'Brake Pads')).rejects.toThrow(/out of date/i)
})

test('fetchQuote fails closed on an incompatible fitment contract', async () => {
  mockFetch.mockReturnValue(jsonResponse({
    fitmentContractVersion: 1,
    items: [],
    subtotal: 0,
    shipping: 0,
    total: 0,
    currency: 'USD',
  }))
  await expect(fetchQuote('2015', 'Toyota', 'Camry', ['Brake Pads'])).rejects.toThrow(/out of date/i)
})

test('repair guide sends the verified listing proof required by the API', async () => {
  mockFetch.mockReturnValue(jsonResponse({ guide: 'Safe overview' }))
  await fetchRepairGuide({
    year: '2020',
    make: 'Toyota',
    model: 'Camry',
    trim: 'LE',
    part: 'Brake Pads',
    listingId: 'ebay-123',
    source: 'eBay',
    fitmentProof: 'signed-proof',
  })

  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toBe(`${API_BASE}/api/ai/repair-guide`)
  expect(JSON.parse(init.body)).toMatchObject({
    listingId: 'ebay-123',
    source: 'eBay',
    fitmentProof: 'signed-proof',
  })
})

test('identifyPartFromImage POSTs the photo as a data URL', async () => {
  mockFetch.mockReturnValue(jsonResponse({ identified: true, partName: 'Brake Pads' }))
  const res = await identifyPartFromImage('data:image/jpeg;base64,b64')
  expect(res.partName).toBe('Brake Pads')
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toBe(`${API_BASE}/api/identify-part`)
  expect(init.method).toBe('POST')
  expect(JSON.parse(init.body).image).toBe('data:image/jpeg;base64,b64')
  expect(init.headers['X-App-Platform']).toBe('ios')
})

test('non-OK responses throw the server error message', async () => {
  mockFetch.mockReturnValue(jsonResponse({ error: 'year must be 4 digits' }, false, 400))
  await expect(fetchMakes()).rejects.toThrow('year must be 4 digits')
})

test('unreadable JSON responses become a user-friendly API error', async () => {
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad json')) })
  await expect(fetchMakes()).rejects.toThrow(/unreadable response/i)
})

test('network failures explain how to recover', async () => {
  mockFetch.mockRejectedValue(new TypeError('Network request failed'))
  await expect(fetchMakes()).rejects.toThrow(/check your connection/i)
})

test('ordinary API requests have a bounded timeout', async () => {
  jest.useFakeTimers()
  mockFetch.mockImplementation((_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('Aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
  )

  const request = expect(fetchMakes()).rejects.toThrow(/timed out/i)
  await jest.advanceTimersByTimeAsync(20_000)
  await request
})

test('account deletion has a bounded client timeout', async () => {
  jest.useFakeTimers()
  mockFetch.mockImplementation((_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('Aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
  )

  const deletion = expect(deleteAccount('DELETE', 'signed-receipt')).rejects.toThrow(/timed out/i)
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
    confirmation: 'DELETE',
    receipt: 'signed-receipt',
  })
  await jest.advanceTimersByTimeAsync(25_000)
  await deletion
})

test('account deletion intent and reconciliation use the signed receipt endpoints', async () => {
  mockFetch
    .mockReturnValueOnce(jsonResponse({ receipt: 'signed-receipt', expiresInMs: 900_000 }))
    .mockReturnValueOnce(jsonResponse({ success: true, deleted: true }))

  await expect(prepareAccountDeletion('DELETE')).resolves.toMatchObject({ receipt: 'signed-receipt' })
  await expect(getAccountDeletionStatus('signed-receipt')).resolves.toMatchObject({ deleted: true })

  expect(mockFetch.mock.calls[0][0]).toBe(`${API_BASE}/api/supabase/account/deletion-intent`)
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ confirmation: 'DELETE' })
  expect(mockFetch.mock.calls[1][0]).toBe(`${API_BASE}/api/supabase/account/deletion-status`)
  expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toEqual({ receipt: 'signed-receipt' })
})
