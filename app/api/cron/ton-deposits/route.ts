import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { recordTransaction } from '@/lib/transactions'
import { getTonAssetName, getTonNetwork, makeTonDepositMemo } from '@/lib/tonWallet'

type ToncenterTransaction = {
  utime?: number
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

const NANOTON_PER_TON = 1_000_000_000

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return process.env.NODE_ENV !== 'production'

  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

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

async function fetchTonTransactions() {
  const address = process.env.TON_CUSTODY_DEPOSIT_ADDRESS
  if (!address) throw new Error('missing TON_CUSTODY_DEPOSIT_ADDRESS')

  const url = new URL(getToncenterUrl())
  url.searchParams.set('address', address)
  url.searchParams.set('limit', process.env.TON_DEPOSIT_SCAN_LIMIT || '30')
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

async function findUserByMemo(users: AppUser[], memo: string) {
  const normalizedMemo = memo.trim().toUpperCase()

  return users.find(user => makeTonDepositMemo(user.id) === normalizedMemo)
}

async function scanTonDeposits(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const transactions = await fetchTonTransactions()
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, balance')
      .limit(1000)

    if (usersError) throw usersError

    let credited = 0
    let skipped = 0
    const asset = getTonAssetName()

    for (const transaction of transactions) {
      const txHash = transaction.transaction_id?.hash || transaction.in_msg?.hash
      const txLt = transaction.transaction_id?.lt || null
      const memo = getTransactionMemo(transaction)
      const amount = getTransactionAmount(transaction)

      if (!txHash || !memo || amount <= 0) {
        skipped += 1
        continue
      }

      const user = await findUserByMemo((users || []) as AppUser[], memo)
      if (!user) {
        skipped += 1
        continue
      }

      const { data: existingDeposit, error: existingError } = await supabase
        .from('ton_deposits')
        .select('id, status')
        .eq('tx_hash', txHash)
        .maybeSingle()

      if (existingError) throw existingError
      if (existingDeposit?.status === 'credited') {
        skipped += 1
        continue
      }

      if (!existingDeposit) {
        const { error: insertError } = await supabase
          .from('ton_deposits')
          .insert({
            tx_hash: txHash,
            tx_lt: txLt,
            user_id: user.id,
            amount,
            asset,
            memo,
            source_address: transaction.in_msg?.source || null,
            raw: transaction,
            status: 'processing',
          })

        if (insertError) {
          if (insertError.code === '23505') {
            skipped += 1
            continue
          }

          throw insertError
        }
      }

      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user.id)
        .single()

      if (currentUserError) throw currentUserError

      const currentBalance = Number(currentUser.balance ?? 0)
      if (!Number.isFinite(currentBalance)) throw new Error('invalid user balance')

      const nextBalance = Number((currentBalance + amount).toFixed(9))
      const { error: balanceError } = await supabase
        .from('users')
        .update({ balance: nextBalance })
        .eq('id', user.id)

      if (balanceError) throw balanceError

      await recordTransaction(supabase, {
        userId: user.id,
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
      credited += 1
    }

    return NextResponse.json({
      ok: true,
      network: getTonNetwork(),
      checked: transactions.length,
      credited,
      skipped,
    })
  } catch (error) {
    console.error('TON deposit scan error:', error)
    return NextResponse.json({ error: 'TON deposit scan failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return scanTonDeposits(request)
}

export async function POST(request: NextRequest) {
  return scanTonDeposits(request)
}
