import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { assertUserDevice } from '@/lib/deviceSecurity'
import { assertRateLimit } from '@/lib/rateLimit'
import { recordSecurityAudit } from '@/lib/securityAudit'
import { parseTonAmount, parseTonDestination, sendTonFromUserWallet } from '@/lib/tonSend'
import { recordTransaction } from '@/lib/transactions'
import { getTonAssetName, getTonNetwork } from '@/lib/tonWallet'

export const runtime = 'nodejs'

const TESTNET_GAS_RESERVE = 0.05
const DEFAULT_TESTNET_WITHDRAW_LIMIT = 5
const DEFAULT_TESTNET_DAILY_WITHDRAW_LIMIT = 10

async function getDailyWithdrawalTotal(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let { data, error } = await supabase
    .from('user_transactions')
    .select('amount, status')
    .eq('user_id', userId)
    .eq('type', 'ton_withdrawal')
    .gte('created_at', since)

  if (error && error.message.includes('status')) {
    const fallback = await supabase
      .from('user_transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'ton_withdrawal')
      .gte('created_at', since)

    data = fallback.data as typeof data
    error = fallback.error
  }

  if (error) throw error

  return (data || []).reduce((sum, transaction) => {
    if ('status' in transaction && transaction.status === 'failed') return sum
    return sum + Math.abs(Number(transaction.amount || 0))
  }, 0)
}

export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID().slice(0, 8)
  let auditUserId: string | null = null

  try {
    if (getTonNetwork() !== 'testnet') {
      return NextResponse.json({ error: 'Withdrawals are testnet only for now' }, { status: 403 })
    }

    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    auditUserId = userId
    const amount = parseTonAmount(body.amount)
    const destination = parseTonDestination(body.address)
    const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 120) : ''
    const withdrawLimit = Number(process.env.TON_TESTNET_WITHDRAW_LIMIT || DEFAULT_TESTNET_WITHDRAW_LIMIT)
    const dailyWithdrawLimit = Number(process.env.TON_TESTNET_DAILY_WITHDRAW_LIMIT || DEFAULT_TESTNET_DAILY_WITHDRAW_LIMIT)
    const supabase = getSupabaseAdmin()

    await assertUserDevice(supabase, {
      userId,
      device: body.device,
      event: 'withdrawal_device_checked',
    })

    await assertRateLimit(supabase, {
      key: `ton-withdrawal:${userId}`,
      limit: 5,
      windowSeconds: 60,
    })

    if (amount > withdrawLimit) {
      return NextResponse.json({ error: `Max test withdrawal is ${withdrawLimit} TON` }, { status: 400 })
    }

    const dailyTotal = await getDailyWithdrawalTotal(supabase, userId)
    if (dailyTotal + amount > dailyWithdrawLimit) {
      return NextResponse.json({ error: `Daily test withdrawal limit is ${dailyWithdrawLimit} TON` }, { status: 400 })
    }

    console.info('TON withdrawal started', {
      traceId,
      userId,
      amount,
      destination: destination.toString({ bounceable: false, testOnly: true }),
    })

    await recordSecurityAudit(supabase, {
      event: 'withdrawal_requested',
      actorUserId: userId,
      targetUserId: userId,
      details: {
        amount,
        traceId,
      },
    })

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

    const sendResult = await sendTonFromUserWallet(supabase, {
      userId,
      destination,
      amount,
      comment,
      gasReserve: TESTNET_GAS_RESERVE,
    })

    console.info('TON withdrawal wallet checked', {
      traceId,
      wallet: sendResult.walletAddress,
      appBalance: currentBalance,
      chainBalance: sendResult.chainBalance,
      status: sendResult.walletStatus,
    })

    console.info('TON withdrawal submitted through TonAPI', {
      traceId,
      seqno: sendResult.seqno,
      txHash: sendResult.txHash,
      walletType: sendResult.walletType,
    })

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
      description: `${getTonAssetName()} send`,
      status: sendResult.pending ? 'pending' : 'confirmed',
      txHash: sendResult.txHash,
    })

    await recordSecurityAudit(supabase, {
      event: 'withdrawal_succeeded',
      actorUserId: userId,
      targetUserId: userId,
      walletAddress: sendResult.walletAddress,
      txHash: sendResult.txHash,
      details: {
        amount,
        pending: sendResult.pending,
        traceId,
      },
    })

    return NextResponse.json({
      ok: true,
      balance: nextBalance,
      amount,
      seqno: sendResult.seqno,
      txHash: sendResult.txHash,
      traceId,
      pending: sendResult.pending,
    })
  } catch (error) {
    console.error('TON withdrawal error:', { traceId, error })
    if (auditUserId) {
      await recordSecurityAudit(getSupabaseAdmin(), {
        event: 'withdrawal_failed',
        actorUserId: auditUserId,
        targetUserId: auditUserId,
        status: 'failed',
        details: {
          traceId,
          reason: error instanceof Error ? error.message : 'Failed to send testnet TON',
        },
      })
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to send testnet TON',
      traceId,
    }, { status: 400 })
  }
}
