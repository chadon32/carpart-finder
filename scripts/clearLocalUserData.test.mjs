import test from 'node:test'
import assert from 'node:assert/strict'
import { isAppLocalKey } from '../src/lib/clearLocalUserData.js'

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
