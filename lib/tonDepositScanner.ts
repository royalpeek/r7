import { SupabaseClient } from '@supabase/supabase-js'
import { recordTransaction } from '@/lib/transactions'
import { getTonAssetName, getTonNetwork, makeTonDepositMemo } from '@/lib/tonWallet'

type ToncenterTransaction = {
  transaction_id?: {
    lt?: string
    hash?: string
  }
  in_msg?: {
    hash?: string
    source?: string
    destination?: string
    value?: string
    message?: string
    msg_data?: {
      '@type'?: string
      text?: string
    }
  }
}

type AppUser = {
  id: string
  balance: number | null
}

type UserTonWallet = {
  user_id: string
  address: string
  raw_address: string | null
}

type ScanTarget = {
  address: string
  userId?: string
  mode: 'unique_address' | 'shared_memo'
}

export type TonDepositScanResult = {
  ok: true
  network: string
  checked: number
  credited: number
  skipped: number
}

const NANOTON_PER_TON = 1_000_000_000

function getToncenterUrl() {
  const baseUrl = getTonNetwork() === 'testnet'
    ? 'https://testnet.toncenter.com'
    : 'https://toncenter.com'

  return `${baseUrl}/api/v2/getTransactions`
}

function decodeBase64Text(value?: string) {
  if (!value) return ''

  try {
    return Buffer.from(value, 'base64').toString('utf8').trim()
  } catch {
    return ''
  }
}

function getTransactionMemo(transaction: ToncenterTransaction) {
  const directMessage = transaction.in_msg?.message?.trim()
  if (directMessage) return directMessage

  const msgData = transaction.in_msg?.msg_data
  if (msgData?.['@type'] === 'msg.dataText') {
    return decodeBase64Text(msgData.text)
  }

  return ''
}

function getTransactionAmount(transaction: ToncenterTransaction) {
  const nanotons = Number(transaction.in_msg?.value || 0)
  if (!Number.isFinite(nanotons) || nanotons <= 0) return 0

  return Number((nanotons / NANOTON_PER_TON).toFixed(9))
}

async function fetchTonTransactions(address: string) {
  const url = new URL(getToncenterUrl())
  url.searchParams.set('address', address)
  url.searchParams.set('limit', process.env.TON_DEPOSIT_SCAN_LIMIT || '20')
  url.searchParams.set('archival', 'false')

  const headers: HeadersInit = {}
  if (process.env.TONCENTER_API_KEY) {
    headers['X-API-Key'] = process.env.TONCENTER_API_KEY
  }

  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Toncenter request failed with ${response.status}`)
  }

  const data = await response.json()
  if (!data.ok) {
    throw new Error(data.error || 'Toncenter returned an error')
  }

  return (data.result || []) as ToncenterTransaction[]
}

function findUserByMemo(users: AppUser[], memo: string) {
  const normalizedMemo = memo.trim().toUpperCase()

  return users.find(user => makeTonDepositMemo(user.id) === normalizedMemo)
}

async function creditTonDeposit(
  supabase: SupabaseClient,
  transaction: ToncenterTransaction,
  {
    userId,
    depositAddress,
    amount,
    memo,
  }: {
    userId: string
    depositAddress: string
    amount: number
    memo: string | null
  }
) {
  const txHash = transaction.transaction_id?.hash || transaction.in_msg?.hash
  if (!txHash) return false

  const { data: existingDeposit, error: existingError } = await supabase
    .from('ton_deposits')
    .select('id, status')
    .eq('tx_hash', txHash)
    .maybeSingle()

  if (existingError) throw existingError
  if (existingDeposit?.status === 'credited') return false

  const asset = getTonAssetName()

  if (!existingDeposit) {
    const { error: insertError } = await supabase
      .from('ton_deposits')
      .insert({
        tx_hash: txHash,
        tx_lt: transaction.transaction_id?.lt || null,
        user_id: userId,
        amount,
        asset,
        memo: memo || '',
        deposit_address: depositAddress,
        source_address: transaction.in_msg?.source || null,
        raw: transaction,
        status: 'processing',
      })

    if (insertError) {
      if (insertError.code === '23505') return false
      throw insertError
    }
  }

  const { data: currentUser, error: currentUserError } = await supabase
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single()

  if (currentUserError) throw currentUserError

  const currentBalance = Number(currentUser.balance ?? 0)
  if (!Number.isFinite(currentBalance)) throw new Error('invalid user balance')

  const nextBalance = Number((currentBalance + amount).toFixed(9))
  const { error: balanceError } = await supabase
    .from('users')
    .update({ balance: nextBalance })
    .eq('id', userId)

  if (balanceError) throw balanceError

  await recordTransaction(supabase, {
    userId,
    type: 'ton_deposit',
    amount,
    balanceAfter: nextBalance,
    description: `${asset} deposit`,
  })

  const { error: depositUpdateError } = await supabase
    .from('ton_deposits')
    .update({
      status: 'credited',
      credited_at: new Date().toISOString(),
    })
    .eq('tx_hash', txHash)

  if (depositUpdateError) throw depositUpdateError

  return true
}

export async function scanTonDeposits(supabase: SupabaseClient): Promise<TonDepositScanResult> {
  const network = getTonNetwork()
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, balance')
    .limit(1000)

  if (usersError) throw usersError

  const { data: userWallets, error: walletsError } = await supabase
    .from('user_ton_wallets')
    .select('user_id, address, raw_address')
    .eq('network', network)
    .eq('status', 'active')
    .limit(1000)

  if (walletsError) throw walletsError

  const targets: ScanTarget[] = ((userWallets || []) as UserTonWallet[]).map(wallet => ({
    address: wallet.address,
    userId: wallet.user_id,
    mode: 'unique_address',
  }))

  const sharedAddress = process.env.TON_CUSTODY_DEPOSIT_ADDRESS
  if (sharedAddress) {
    targets.push({
      address: sharedAddress,
      mode: 'shared_memo',
    })
  }

  let checked = 0
  let credited = 0
  let skipped = 0

  for (const target of targets) {
    const transactions = await fetchTonTransactions(target.address)
    checked += transactions.length

    for (const transaction of transactions) {
      const amount = getTransactionAmount(transaction)
      const memo = getTransactionMemo(transaction)
      const user = target.mode === 'unique_address'
        ? { id: target.userId } as AppUser
        : findUserByMemo((users || []) as AppUser[], memo)

      if (!user?.id || amount <= 0) {
        skipped += 1
        continue
      }

      const didCredit = await creditTonDeposit(supabase, transaction, {
        userId: user.id,
        depositAddress: target.address,
        amount,
        memo: memo || null,
      })

      if (didCredit) {
        credited += 1
      } else {
        skipped += 1
      }
    }
  }

  return {
    ok: true,
    network,
    checked,
    credited,
    skipped,
  }
}
