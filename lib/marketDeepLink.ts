export function buildMarketStartParam(pollId: string, referralCode?: string | null) {
  const cleanReferralCode = referralCode?.trim()
  return cleanReferralCode
    ? `market_${pollId}_ref_${cleanReferralCode}`
    : `market_${pollId}`
}

export function buildReferralStartParam(referralCode: string) {
  return `ref_${referralCode.trim()}`
}

export function parseMarketStartParam(rawValue?: string | null) {
  if (!rawValue) return { marketId: null, referralCode: null }

  const value = rawValue.trim()
  const referralPrefix = 'ref_'
  if (value.startsWith(referralPrefix)) {
    return {
      marketId: null,
      referralCode: value.slice(referralPrefix.length) || null,
    }
  }

  const marketPrefix = 'market_'
  if (!value.startsWith(marketPrefix)) {
    return {
      marketId: value || null,
      referralCode: null,
    }
  }

  const payload = value.slice(marketPrefix.length)
  const referralMarker = '_ref_'
  const referralIndex = payload.indexOf(referralMarker)

  if (referralIndex === -1) {
    return {
      marketId: payload || null,
      referralCode: null,
    }
  }

  return {
    marketId: payload.slice(0, referralIndex) || null,
    referralCode: payload.slice(referralIndex + referralMarker.length) || null,
  }
}
