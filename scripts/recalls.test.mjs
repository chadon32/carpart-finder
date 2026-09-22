import assert from 'node:assert/strict'
import test from 'node:test'
import { isRecallList } from '../shared/recalls.js'

const recall = { campaignNumber: null, component: 'Test component', summary: null, consequence: null, remedy: null, reportedDate: null }

test('recall contract accepts explicit empty results and nullable text records', () => {
  assert.equal(isRecallList([]), true)
  assert.equal(isRecallList([recall]), true)
})

test('recall contract rejects malformed containers, incomplete records and non-text fields', () => {
  for (const value of [null, {}, '', [null], [{}], [{ ...recall, component: {} }], [{ ...recall, remedy: 12 }]]) {
    assert.equal(isRecallList(value), false)
  }
})
