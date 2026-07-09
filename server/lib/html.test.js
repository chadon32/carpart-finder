import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, safeListingUrl } from './html.js'

test('escapes the five XML-significant characters', () => {
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;')
})

test('does not double-escape ampersands', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b')
  assert.equal(escapeHtml('<'), '&lt;')
})

test('neutralizes an attribute-breakout payload', () => {
  const out = escapeHtml('"><script>alert(1)</script>')
  assert.ok(!out.includes('<script>'))
  assert.ok(!out.includes('">'))
})

test('coerces non-strings safely', () => {
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(undefined), '')
  assert.equal(escapeHtml(42), '42')
})

test('accepts a normal https eBay url', () => {
  const url = 'https://www.ebay.com/itm/12345'
  assert.equal(safeListingUrl(url), url)
})

test('accepts a bare ebay.com host', () => {
  assert.equal(safeListingUrl('https://ebay.com/itm/1'), 'https://ebay.com/itm/1')
})

test('rejects javascript: urls', () => {
  assert.equal(safeListingUrl('javascript:alert(1)'), null)
})

test('rejects data: urls', () => {
  assert.equal(safeListingUrl('data:text/html,<script>alert(1)</script>'), null)
})

test('rejects non-eBay hosts', () => {
  assert.equal(safeListingUrl('https://evil.example/itm/1'), null)
})

test('rejects a lookalike suffix host', () => {
  assert.equal(safeListingUrl('https://ebay.com.evil.example/x'), null)
})

test('rejects a lookalike prefix host', () => {
  assert.equal(safeListingUrl('https://notebay.com/x'), null)
})

test('rejects http (non-TLS)', () => {
  assert.equal(safeListingUrl('http://www.ebay.com/itm/1'), null)
})

test('rejects garbage and empty values', () => {
  assert.equal(safeListingUrl('not a url'), null)
  assert.equal(safeListingUrl(null), null)
  assert.equal(safeListingUrl(undefined), null)
  assert.equal(safeListingUrl(''), null)
})

test('host matching is case-insensitive', () => {
  assert.equal(safeListingUrl('https://WWW.EBAY.COM/itm/1'), 'https://www.ebay.com/itm/1')
})
