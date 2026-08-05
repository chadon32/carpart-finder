const loadRetailerLinks = () => {
  let retailerModule: typeof import('../retailerLinks') | undefined
  jest.isolateModules(() => {
    retailerModule = require('../retailerLinks') as typeof import('../retailerLinks')
  })
  return retailerModule!
}

const originalAmazonTag = process.env.EXPO_PUBLIC_AMAZON_MOBILE_TAG

afterEach(() => {
  if (originalAmazonTag === undefined) delete process.env.EXPO_PUBLIC_AMAZON_MOBILE_TAG
  else process.env.EXPO_PUBLIC_AMAZON_MOBILE_TAG = originalAmazonTag
})

test('builds a normal Amazon search URL when no mobile affiliate tag is configured', () => {
  delete process.env.EXPO_PUBLIC_AMAZON_MOBILE_TAG
  const { buildAmazonSearchUrl, isMobileAmazonAffiliateEnabled } = loadRetailerLinks()

  expect(isMobileAmazonAffiliateEnabled).toBe(false)
  expect(buildAmazonSearchUrl('brake pads')).toBe('https://www.amazon.com/s?k=brake%20pads')
})

test('adds the Amazon tag only when the mobile tag is configured', () => {
  process.env.EXPO_PUBLIC_AMAZON_MOBILE_TAG = 'mobile-tag-20'
  const { buildAmazonSearchUrl, isMobileAmazonAffiliateEnabled } = loadRetailerLinks()

  expect(isMobileAmazonAffiliateEnabled).toBe(true)
  expect(buildAmazonSearchUrl('brake pads')).toBe(
    'https://www.amazon.com/s?k=brake%20pads&tag=mobile-tag-20'
  )
})
