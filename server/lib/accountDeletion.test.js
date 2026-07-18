import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteAccountPermanently, isAlreadyDeletedAuthError } from './accountDeletion.js'

function fakeAdmin({ dataError = null, authError = null, events = [] } = {}) {
  return {
    rpc: async (name, args) => {
      events.push(['rpc', name, args])
      return { error: dataError }
    },
    auth: {
      admin: {
        deleteUser: async (id, shouldSoftDelete) => {
          events.push(['auth', id, shouldSoftDelete])
          return { error: authError }
        },
      },
    },
  }
}

test('account deletion removes data before permanently deleting Auth user', async () => {
  const events = []
  const result = await deleteAccountPermanently({
    admin: fakeAdmin({ events }),
    userId: 'user-1',
    email: 'USER@example.com',
  })

  assert.deepEqual(result, { success: true, alreadyDeleted: false })
  assert.deepEqual(events, [
    ['rpc', 'delete_user_data', { p_user_id: 'user-1', p_email: 'USER@example.com' }],
    ['auth', 'user-1', false],
  ])
})
test('data cleanup failure never attempts Auth deletion', async () => {
  const events = []
  const result = await deleteAccountPermanently({
    admin: fakeAdmin({ dataError: new Error('RPC failed'), events }),
    userId: 'user-data-failure',
  })

  assert.equal(result.success, false)
  assert.equal(result.stage, 'data')
  assert.deepEqual(events, [['rpc', 'delete_user_data', { p_user_id: 'user-data-failure', p_email: null }]])
})

test('an already-deleted Auth user is treated as an idempotent success', async () => {
  const result = await deleteAccountPermanently({
    admin: fakeAdmin({ authError: { status: 404, message: 'User not found' } }),
    userId: 'user-already-gone',
  })

  assert.deepEqual(result, { success: true, alreadyDeleted: true })
})

test('concurrent requests for one user share a single deletion operation', async () => {
  const events = []
  let resolveRpc
  const rpc = new Promise((resolve) => {
    resolveRpc = resolve
  })
  const admin = fakeAdmin({ events })
  admin.rpc = () => rpc

  const first = deleteAccountPermanently({ admin, userId: 'user-concurrent' })
  const second = deleteAccountPermanently({ admin, userId: 'user-concurrent' })
  assert.strictEqual(first, second)
  resolveRpc({ error: null })
  await first
  assert.deepEqual(events, [['auth', 'user-concurrent', false]])
})

test('only expected Auth not-found errors are idempotent', () => {
  assert.equal(isAlreadyDeletedAuthError({ status: 404 }), true)
  assert.equal(isAlreadyDeletedAuthError({ code: 'user_not_found' }), true)
  assert.equal(isAlreadyDeletedAuthError({ status: 403, message: 'permission denied' }), false)
})
