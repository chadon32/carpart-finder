import { deriveResultsState } from '../resultsState'
import type { Listing, SearchResponse } from '../../api/types'

const base: SearchResponse = { query: 'q', results: [], providerErrors: {}, skippedProviders: [] }
const listing = { id: '1' } as Listing

test('loading when no response and no error', () =>
  expect(deriveResultsState(null, false)).toBe('loading'))

test('error when fetch rejected', () => expect(deriveResultsState(null, true)).toBe('error'))

test('empty when live search returns nothing', () =>
  expect(deriveResultsState(base, false)).toBe('empty'))

test('stale flagged results stay marked stale', () =>
  expect(deriveResultsState({ ...base, results: [listing], stale: true }, false)).toBe('stale'))

test('live when results and not stale', () =>
  expect(deriveResultsState({ ...base, results: [listing] }, false)).toBe('live'))

test('failed refresh keeps existing results visible as stale', () =>
  expect(deriveResultsState({ ...base, results: [listing] }, true)).toBe('stale'))

test('failed refresh with nothing to show is an error', () =>
  expect(deriveResultsState(base, true)).toBe('error'))
