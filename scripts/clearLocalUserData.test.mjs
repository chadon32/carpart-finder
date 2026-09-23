import test from 'node:test'
import assert from 'node:assert/strict'
import { clearLocalUserData, isAppLocalKey } from '../src/lib/clearLocalUserData.js'

test('account deletion recognizes all app-owned local and session keys', () => {
  for (const key of [
    'carpartsradar-user',
    'carpartsradar-garage',
    'car-part-finder-recent',
    'car-part-finder-cart-user_example_com',
    'cpf-dark-mode',
    'cpf-sort',
    'cpf-condition',
    'cpf-hide-overseas',
    'cpf-fast-shipping',
    'cpf-min-rating',
    'cpf-zip',
    'cpf-recalls-2020|toyota|camry',
  ]) {
    assert.equal(isAppLocalKey(key), true, key)
  }
  assert.equal(isAppLocalKey('unrelated-application-key'), false)
})

test('ordinary logout clears user data while preserving the device theme', () => {
  const makeStorage = (values) => {
    const storage = { ...values }
    Object.defineProperty(storage, 'removeItem', {
      enumerable: false,
      value(key) {
        delete storage[key]
      },
    })
    return storage
  }
  const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const previousSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  const local = makeStorage({
    'carpartsradar-user': '{"email":"driver@example.com"}',
    'carpartsradar-garage': '[{"vin":"sensitive"}]',
    'cpf-dark-mode': 'true',
    'unrelated-application-key': 'keep',
  })
  const session = makeStorage({ 'cpf-zip': '85001' })

  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local })
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session })
  try {
    assert.equal(clearLocalUserData({ preserveDevicePreferences: true }), true)
    assert.equal(local['carpartsradar-user'], undefined)
    assert.equal(local['carpartsradar-garage'], undefined)
    assert.equal(local['cpf-dark-mode'], 'true')
    assert.equal(local['unrelated-application-key'], 'keep')
    assert.equal(session['cpf-zip'], undefined)
  } finally {
    if (previousLocalStorage) Object.defineProperty(globalThis, 'localStorage', previousLocalStorage)
    else delete globalThis.localStorage
    if (previousSessionStorage) Object.defineProperty(globalThis, 'sessionStorage', previousSessionStorage)
    else delete globalThis.sessionStorage
  }
})
