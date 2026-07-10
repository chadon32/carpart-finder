import { useAuth } from '../auth'

const mockFetch = jest.fn()
globalThis.fetch = mockFetch as unknown as typeof fetch

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  mockFetch.mockReset()
  useAuth.setState({ user: null, status: 'unknown' })
})

test('login success signs in and sends credentials', async () => {
  mockFetch.mockReturnValue(jsonResponse({ user: { id: 'u1', email: 'a@b.c' } }))
  await useAuth.getState().login('a@b.c', 'password123')
  expect(useAuth.getState().status).toBe('signedIn')
  expect(useAuth.getState().user?.email).toBe('a@b.c')
  const [, init] = mockFetch.mock.calls[0]
  expect(init.credentials).toBe('include')
})

test('signup needing email confirmation does not sign in', async () => {
  mockFetch.mockReturnValue(jsonResponse({ user: { id: 'u1' }, confirmationRequired: true }))
  const r = await useAuth.getState().signup('a@b.c', 'password123')
  expect(r.confirmationRequired).toBe(true)
  expect(useAuth.getState().status).toBe('unknown')
})

test('failed me check resolves to signedOut', async () => {
  mockFetch.mockReturnValue(jsonResponse({ error: 'Not authenticated' }, false, 401))
  await useAuth.getState().loadMe()
  expect(useAuth.getState().status).toBe('signedOut')
})

test('login failure surfaces the server message and stays signed out', async () => {
  mockFetch.mockReturnValue(jsonResponse({ error: 'Invalid login credentials' }, false, 400))
  await expect(useAuth.getState().login('a@b.c', 'password123')).rejects.toThrow(
    'Invalid login credentials'
  )
  expect(useAuth.getState().user).toBeNull()
})
