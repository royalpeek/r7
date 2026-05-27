export const CREATOR_OPEN_MARKET_LIMIT = 2

export function getOpenMarketCutoff(now = new Date()) {
  return now.toISOString()
}
