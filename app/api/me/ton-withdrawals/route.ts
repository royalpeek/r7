import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { Address, SendMode, internal, toNano } from '@ton/core'
import { mnemonicToPrivateKey } from '@ton/crypto'
import { TonClient, WalletContractV4 } from '@ton/ton'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { recordTransaction } from '@/lib/transactions'
import { getTonAssetName, getTonNetwork, getToncenterJsonRpcEndpoint, getUserTonWalletSecret } from '@/lib/tonWallet'

export const runtime = 'nodejs'

const TESTNET_GAS_RESERVE = 0.05
const DEFAULT_TESTNET_WITHDRAW_LIMIT = 5

function parseAmount(value: unknown) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid amount')

  return Number(amount.toFixed(9))
}

function parseDestination(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a wallet address')

  try {
    return Address.parse(value.trim())
  } catch {
    throw new Error('Enter a valid TON address')
  }
}

export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID().slice(0, 8)

  try {
    if (getTonNetwork() !== 'testnet') {
      return NextResponse.json({ error: 'Withdrawals are testnet only for now' }, { status: 403 })
    }

    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const amount = parseAmount(body.amount)
    const destination = parseDestination(body.address)
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 120) : ''
    const withdrawLimit = Number(process.env.TON_TESTNET_WITHDRAW_LIMIT || DEFAULT_TESTNET_WITHDRAW_LIMIT)

    if (amount > withdrawLimit) {
      return NextResponse.json({ error: `Max test withdrawal is ${withdrawLimit} TON` }, { status: 400 })
    }

    console.info('TON withdrawal started', {
      traceId,
      userId,
      amount,
      destination: destination.toString({ bounceable: false, testOnly: true }),
    })

    const supabase = getSupabaseAdmin()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const currentBalance = Number(user.balance ?? 0)
    if (!Number.isFinite(currentBalance)) throw new Error('Invalid balance')
    if (amount + TESTNET_GAS_RESERVE > currentBalance) {
      return NextResponse.json({ error: `Leave at least ${TESTNET_GAS_RESERVE} TON for fees` }, { status: 400 })
    }

    const storedWallet = await getUserTonWalletSecret(supabase, userId)
    const keyPair = await mnemonicToPrivateKey(storedWallet.mnemonic)
    const wallet = WalletContractV4.create({
      workchain: 0,
      publicKey: keyPair.publicKey,
    })
    const client = new TonClient({
      endpoint: getToncenterJsonRpcEndpoint(),
      apiKey: process.env.TONCENTER_API_KEY,
    })
    const openedWallet = client.open(wallet)
    const chainBalance = Number(await client.getBalance(wallet.address)) / 1_000_000_000

    console.info('TON withdrawal wallet checked', {
      traceId,
      wallet: wallet.address.toString({ bounceable: false, testOnly: true }),
      appBalance: currentBalance,
      chainBalance,
    })

    if (amount + TESTNET_GAS_RESERVE > chainBalance) {
      return NextResponse.json({ error: 'Wallet needs more testnet TON for this send' }, { status: 400 })
    }

    const isDeployed = await client.isContractDeployed(wallet.address)
    const seqno = isDeployed ? await openedWallet.getSeqno() : 0
    await openedWallet.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: destination,
          value: toNano(amount.toString()),
          bounce: false,
          body: comment || undefined,
        }),
      ],
    })

    console.info('TON withdrawal submitted', { traceId, seqno })

    const nextBalance = Number((currentBalance - amount).toFixed(9))
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: nextBalance })
      .eq('id', userId)

    if (balanceError) throw balanceError

    await recordTransaction(supabase, {
      userId,
      type: 'ton_withdrawal',
      amount: -amount,
      balanceAfter: nextBalance,
      description: `${getTonAssetName()} withdrawal`,
    })

    return NextResponse.json({
      ok: true,
      balance: nextBalance,
      amount,
      seqno,
      traceId,
    })
  } catch (error) {
    console.error('TON withdrawal error:', { traceId, error })
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send testnet TON',
      traceId,
    }, { status: 400 })
  }
}
