import crypto from 'node:crypto'

export function makeTonDepositMemo(userId: string) {
  const secret = process.env.TON_CUSTODY_MEMO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'r7-dev-secret'
  const digest = crypto
    .createHmac('sha256', secret)
    .update(userId)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()

  return `R7-${digest}`
}

export function getTonNetwork() {
  return process.env.TON_NETWORK === 'testnet' ? 'testnet' : 'mainnet'
}

export function getTonAssetName() {
  const network = getTonNetwork()
  const defaultAsset = network === 'testnet' ? 'Testnet TON' : 'USDT on TON'

  return process.env.TON_CUSTODY_ASSET_NAME || defaultAsset
}
