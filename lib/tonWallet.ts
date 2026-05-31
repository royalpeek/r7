import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { mnemonicNew, mnemonicToPrivateKey } from '@ton/crypto'
import { WalletContractV4 } from '@ton/ton'
import { recordSecurityAudit } from '@/lib/securityAudit'

type StoredTonWallet = {
  id: string
  user_id: string
  network: string
  address: string
  raw_address: string
  public_key: string
}

type StoredTonWalletSecret = StoredTonWallet & {
  mnemonic_encrypted: string
}

/*
 * R7 uses custodial TON wallets: the server creates and signs from wallets for users.
 * TON_WALLET_ENCRYPTION_KEY is the master key protecting user wallet mnemonics.
 * Never expose it with NEXT_PUBLIC_, never log it, and never return decrypted secrets.
 */
export function makeTonDepositMemo(userId: string) {
  const secret = process.env.TON_CUSTODY_MEMO_SECRET || 'r7-dev-secret'
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
  const defaultAsset = network === 'testnet' ? 'Test TON' : 'USDT on TON'

  return process.env.TON_CUSTODY_ASSET_NAME || defaultAsset
}

function getEncryptionKey() {
  if (process.env.NEXT_PUBLIC_TON_WALLET_ENCRYPTION_KEY) {
    throw new Error('TON wallet encryption key must be server-only')
  }

  const secret = process.env.TON_WALLET_ENCRYPTION_KEY

  if (!secret) throw new Error('missing TON_WALLET_ENCRYPTION_KEY')

  return crypto.createHash('sha256').update(secret).digest()
}

function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

function decryptSecret(value: string) {
  const [iv, tag, encrypted] = value.split(':')
  if (!iv || !tag || !encrypted) throw new Error('invalid encrypted TON secret')

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

export async function getOrCreateUserTonWallet(supabase: SupabaseClient, userId: string) {
  const network = getTonNetwork()
  const { data: existingWallet, error: existingError } = await supabase
    .from('user_ton_wallets')
    .select('id, user_id, network, address, raw_address, public_key')
    .eq('user_id', userId)
    .eq('network', network)
    .maybeSingle()

  if (existingError) throw existingError
  if (existingWallet) return existingWallet as StoredTonWallet

  const mnemonic = await mnemonicNew(24)
  const keyPair = await mnemonicToPrivateKey(mnemonic)
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  })
  const address = wallet.address.toString({
    bounceable: false,
    testOnly: network === 'testnet',
  })
  const rawAddress = wallet.address.toRawString()
  const publicKey = Buffer.from(keyPair.publicKey).toString('hex')

  const { data: createdWallet, error: createError } = await supabase
    .from('user_ton_wallets')
    .insert({
      user_id: userId,
      network,
      address,
      raw_address: rawAddress,
      public_key: publicKey,
      mnemonic_encrypted: encryptSecret(mnemonic.join(' ')),
      status: 'active',
    })
    .select('id, user_id, network, address, raw_address, public_key')
    .single()

  if (createError) throw createError

  await recordSecurityAudit(supabase, {
    event: 'wallet_created',
    actorUserId: userId,
    targetUserId: userId,
    walletAddress: address,
    details: {
      network,
    },
  })

  return createdWallet as StoredTonWallet
}

export async function getUserTonWalletSecret(supabase: SupabaseClient, userId: string) {
  const network = getTonNetwork()
  const { data: wallet, error } = await supabase
    .from('user_ton_wallets')
    .select('id, user_id, network, address, raw_address, public_key, mnemonic_encrypted')
    .eq('user_id', userId)
    .eq('network', network)
    .eq('status', 'active')
    .single()

  if (error) throw error

  const storedWallet = wallet as StoredTonWalletSecret

  return {
    id: storedWallet.id,
    user_id: storedWallet.user_id,
    network: storedWallet.network,
    address: storedWallet.address,
    raw_address: storedWallet.raw_address,
    public_key: storedWallet.public_key,
    mnemonic: decryptSecret(storedWallet.mnemonic_encrypted).split(' '),
  }
}

export function getToncenterJsonRpcEndpoint() {
  return getTonNetwork() === 'testnet'
    ? 'https://testnet.toncenter.com/api/v2/jsonRPC'
    : 'https://toncenter.com/api/v2/jsonRPC'
}
