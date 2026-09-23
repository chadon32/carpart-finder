const MOBILE_CHANNELS = new Set(['ios', 'android'])

export function normalizeAffiliateChannel(value) {
  const channel = String(value ?? '').trim().toLowerCase()
  return MOBILE_CHANNELS.has(channel) ? channel : 'web'
}

export function affiliateContextForChannel(channel, {
  campaignId,
  mobileApproved = false,
} = {}) {
  const normalizedChannel = normalizeAffiliateChannel(channel)
  const normalizedCampaignId = String(campaignId ?? '').trim()

  if (!normalizedCampaignId) return null
  if (MOBILE_CHANNELS.has(normalizedChannel) && mobileApproved !== true) return null

  return {
    campaignId: normalizedCampaignId,
    // eBay exposes this as customid/SUB-ID in EPN reporting. Keep it coarse,
    // stable, and free of user or vehicle data.
    referenceId: `cpr-${normalizedChannel}-search`,
  }
}
