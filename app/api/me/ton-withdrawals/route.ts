import { NextRequest, NextResponse } from 'next/server'
import { Address, SendMode, internal, toNano } from '@ton/core'
import { mnemonicToPrivateKey } from '@ton/crypto'
import { TonClient, WalletContractV4 } from '@ton/ton'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { recordTransaction } from '@/lib/transactions'
import { getTonAssetName, getTonNetwork, getToncenterJsonRpcEndpoint, getUserTonWalletSecret } from '@/lib/tonWallet'

const TESTNET_GAS_RESERVE = 0.05
const DEFAULT_TESTNET_WITHDRAW_LIMIT = 5
const CONFIRMATION_ATTEMPTS = 5
const CONFIRMATION_DELAY_MS = 1000

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

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
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

    let confirmedSeqno = seqno
    for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt += 1) {
      await wait(CONFIRMATION_DELAY_MS)
      try {
        confirmedSeqno = await openedWallet.getSeqno()
      } catch (error) {
        console.error('TON confirmation check error:', error)
      }
      if (confirmedSeqno > seqno) break
    }

    if (confirmedSeqno <= seqno) {
      return NextResponse.json({
        error: 'TON is still processing this send. Please wait a minute before trying again.',
      }, { status: 400 })
    }

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
    })
  } catch (error) {
    console.error('TON withdrawal error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send testnet TON',
    }, { status: 400 })
  }
}
