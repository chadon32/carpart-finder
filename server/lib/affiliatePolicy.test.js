import test from 'node:test'
import assert from 'node:assert/strict'
import { affiliateContextForChannel, normalizeAffiliateChannel } from './affiliatePolicy.js'

test('normalizes unknown clients to the web channel', () => {
  assert.equal(normalizeAffiliateChannel('ios'), 'ios')
  assert.equal(normalizeAffiliateChannel('ANDROID'), 'android')
  assert.equal(normalizeAffiliateChannel('spoofed-client'), 'web')
  assert.equal(normalizeAffiliateChannel(), 'web')
})

test('web searches receive an EPN reference id when a campaign is configured', () => {
  assert.deepEqual(
    affiliateContextForChannel('web', { campaignId: '5339012345' }),
    { campaignId: '5339012345', referenceId: 'cpr-web-search' }
  )
})

test('mobile affiliate attribution fails closed until written approval is configured', () => {
  assert.equal(
    affiliateContextForChannel('ios', { campaignId: '5339012345', mobileApproved: false }),
    null
  )
  assert.deepEqual(
    affiliateContextForChannel('ios', { campaignId: '5339012345', mobileApproved: true }),
    { campaignId: '5339012345', referenceId: 'cpr-ios-search' }
  )
})

test('no campaign id means no affiliate context on any platform', () => {
  assert.equal(affiliateContextForChannel('web', { campaignId: '' }), null)
  assert.equal(affiliateContextForChannel('ios', { mobileApproved: true }), null)
})
