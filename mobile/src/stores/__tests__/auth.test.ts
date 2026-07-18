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

test('successful deletion clears the session and calls server logout', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch
    .mockReturnValueOnce(jsonResponse({ success: true }))
    .mockReturnValueOnce(jsonResponse({ success: true }))

  await useAuth.getState().deleteAccount('DELETE')

  expect(useAuth.getState().status).toBe('signedOut')
  expect(useAuth.getState().user).toBeNull()
  expect(mockFetch).toHaveBeenCalledTimes(2)
  expect(mockFetch.mock.calls[0][0]).toContain('/api/supabase/account')
  expect(mockFetch.mock.calls[0][1].method).toBe('DELETE')
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ confirmation: 'DELETE' })
  expect(mockFetch.mock.calls[1][0]).toContain('/api/supabase/logout')
})

test('failed deletion keeps the signed-in session', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Could not remove your account data. Please try again.' }, false, 500))

  await expect(useAuth.getState().deleteAccount('DELETE')).rejects.toThrow(/Could not remove/)
  expect(useAuth.getState().status).toBe('signedIn')
  expect(mockFetch).toHaveBeenCalledTimes(1)
})

test('expired deletion session signs out locally and requires reauthentication', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Invalid or expired token' }, false, 401))

  await expect(useAuth.getState().deleteAccount('DELETE')).rejects.toThrow(/expired token/)
  expect(useAuth.getState().status).toBe('signedOut')
})

test('network error does not clear local account state', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))

  await expect(useAuth.getState().deleteAccount('DELETE')).rejects.toThrow(/Network request failed/)
  expect(useAuth.getState().status).toBe('signedIn')
})

test('already-deleted account response completes local cleanup idempotently', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  mockFetch
    .mockReturnValueOnce(jsonResponse({ success: true, alreadyDeleted: true }))
    .mockReturnValueOnce(jsonResponse({ success: true }))

  await useAuth.getState().deleteAccount('DELETE')
  expect(useAuth.getState().status).toBe('signedOut')
})

test('multiple rapid deletion calls share one request', async () => {
  useAuth.setState({ user: { id: 'u1', email: 'a@b.c' }, status: 'signedIn' })
  let resolveDelete: (value: unknown) => void = () => undefined
  const pendingDelete = new Promise((resolve) => {
    resolveDelete = resolve
  })
  mockFetch
    .mockReturnValueOnce(pendingDelete)
    .mockReturnValueOnce(jsonResponse({ success: true }))

  const first = useAuth.getState().deleteAccount('DELETE')
  const second = useAuth.getState().deleteAccount('DELETE')
  expect(first).toBe(second)
  expect(mockFetch).toHaveBeenCalledTimes(1)
  resolveDelete(jsonResponse({ success: true }))
  await Promise.all([first, second])
  expect(mockFetch).toHaveBeenCalledTimes(2)
})
