import test from 'node:test'
import assert from 'node:assert/strict'
import { safeRetailerUrl } from '../../shared/outboundUrl.js'

test('outbound retailer policy accepts approved HTTPS domains and subdomains', () => {
  assert.equal(safeRetailerUrl('https://www.ebay.com/itm/123'), 'https://www.ebay.com/itm/123')
  assert.equal(safeRetailerUrl('https://s.click.aliexpress.com/e/example'), 'https://s.click.aliexpress.com/e/example')
})

test('outbound retailer policy rejects dangerous schemes, credentials, and lookalikes', () => {
  assert.equal(safeRetailerUrl('javascript:alert(1)'), null)
  assert.equal(safeRetailerUrl('http://www.ebay.com/itm/123'), null)
  assert.equal(safeRetailerUrl('https://ebay.com.evil.example/itm/123'), null)
  assert.equal(safeRetailerUrl('https://user:password@ebay.com/itm/123'), null)
})
