export const TRADING_ASSET_NAME = process.env.NEXT_PUBLIC_TON_CUSTODY_ASSET_NAME || 'Test TON'

export function formatTradingAsset(value: number, decimals = 3) {
  const amount = Number.isFinite(value) ? value : 0
  return `${amount.toFixed(decimals)} ${TRADING_ASSET_NAME}`
}

export function formatSignedTradingAsset(value: number, decimals = 3) {
  const amount = Number.isFinite(value) ? value : 0
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${Math.abs(amount).toFixed(decimals)} ${TRADING_ASSET_NAME}`
}
