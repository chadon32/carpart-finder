import test from 'node:test'
import assert from 'node:assert/strict'
import {
  API_RELEASE,
  FITMENT_CONTRACT_VERSION,
  assertFitmentContract,
} from '../shared/apiContract.js'

test('accepts only the current fitment contract', () => {
  const payload = {
    fitmentContractVersion: FITMENT_CONTRACT_VERSION,
    results: [],
  }
  assert.equal(assertFitmentContract(payload), payload)
  assert.match(API_RELEASE, /^\d{4}-\d{2}-\d{2}/)
})

test('fails closed when a stale API omits or changes the contract version', () => {
  assert.throws(
    () => assertFitmentContract({ results: [] }),
    /search service is out of date/i
  )
  assert.throws(
    () => assertFitmentContract({ fitmentContractVersion: 1, results: [] }),
    /restart or redeploy the API/i
  )
})
