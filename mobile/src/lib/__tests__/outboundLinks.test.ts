import { prepareNonAffiliateShareUrl, prepareOutboundUrl } from '../outboundLinks'

test('allows HTTPS links to approved retailer domains and preserves the full URL', () => {
  const url = 'https://www.rockauto.com/en/moreinfo.php?pk=123&cc=456#details'
  expect(prepareOutboundUrl(url)).toBe(url)
})

test('rejects invalid protocols and unapproved hosts', () => {
  expect(prepareOutboundUrl('http://www.ebay.com/itm/123')).toBeNull()
  expect(prepareOutboundUrl('https://www.ebay.com.evil.example/itm/123')).toBeNull()
  expect(prepareOutboundUrl('not a url')).toBeNull()
})

test('removes EPN parameters from eBay links until mobile approval is enabled', () => {
  const url = 'https://www.ebay.com/itm/123?item=keep&campid=1&customid=abc&mkcid=2&mkevt=1&mkrid=711-53200-19255-0&toolid=10001#details'
  expect(prepareOutboundUrl(url, false)).toBe('https://www.ebay.com/itm/123?item=keep#details')
  expect(prepareOutboundUrl(url, true)).toBe(url)
})

test('prepares a non-affiliate share URL while preserving the ordinary destination', () => {
  expect(
    prepareNonAffiliateShareUrl('https://www.amazon.com/s?k=brake+pads&tag=mobile-20&ref=sr_1_1#results')
  ).toBe('https://www.amazon.com/s?k=brake+pads&ref=sr_1_1#results')
  expect(
    prepareNonAffiliateShareUrl('https://www.ebay.com/itm/123?campid=1&customid=abc&item=keep')
  ).toBe('https://www.ebay.com/itm/123?item=keep')
})
