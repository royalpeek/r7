import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { recordSecurityAudit } from '@/lib/securityAudit'
import { assertRequestRateLimit } from '@/lib/requestSecurity'
import { parseTonAmount, parseTonDestination, sendTonFromUserWallet } from '@/lib/tonSend'
import { recordTransaction } from '@/lib/transactions'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { getTonAssetName, getTonNetwork } from '@/lib/tonWallet'

export const runtime = 'nodejs'

const TESTNET_GAS_RESERVE = 0.05
const DEFAULT_ADMIN_RECOVERY_LIMIT = 25

async function requireAdmin(initData: string) {
  const telegramUser = getRequestTelegramUser(initData)
  const adminUserId = String(telegramUser.id)
  const supabase = getSupabaseAdmin()

  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', adminUserId)
    .single()

  if (error) throw error
  if (user?.role !== 'admin') throw new Error('admin access required')

  return { supabase, adminUserId }
}

export async function POST(request: NextRequest) {
  const traceId = crypto.randomUUID().slice(0, 8)
  let adminUserId: string | null = null
  let targetUserId: string | null = null

  try {
    if (getTonNetwork() !== 'testnet') {
      return NextResponse.json({ error: 'Admin recovery is testnet only for now' }, { status: 403 })
    }

    const body = await request.json()
    const auth = await requireAdmin(body.initData)
    const supabase = auth.supabase
    adminUserId = auth.adminUserId
    targetUserId = String(body.userId || '').trim()
    if (!targetUserId) throw new Error('target user is required')

    await assertRequestRateLimit(supabase, {
      key: `admin-ton-recovery:${adminUserId}`,
      limit: 3,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: adminUserId,
      targetUserId,
      details: { phase: 'admin_ton_recovery' },
    })

    const amount = parseTonAmount(body.amount)
    const destination = parseTonDestination(body.address)
    const recoveryLimit = Number(process.env.TON_ADMIN_RECOVERY_LIMIT || DEFAULT_ADMIN_RECOVERY_LIMIT)
    if (amount > recoveryLimit) {
      return NextResponse.json({ error: `Max recovery send is ${recoveryLimit} TON` }, { status: 400 })
    }

    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('id, balance')
      .eq('id', targetUserId)
      .single()

    if (targetError) throw targetError

    const currentBalance = Number(targetUser.balance ?? 0)
    if (!Number.isFinite(currentBalance)) throw new Error('invalid target balance')
    if (amount + TESTNET_GAS_RESERVE > currentBalance) {
      return NextResponse.json({ error: `Leave at least ${TESTNET_GAS_RESERVE} TON for fees` }, { status: 400 })
    }

    await recordSecurityAudit(supabase, {
      event: 'admin_recovery_requested',
      actorUserId: adminUserId,
      targetUserId,
      details: {
        amount,
        traceId,
      },
    })

    const sendResult = await sendTonFromUserWallet(supabase, {
      userId: targetUserId,
      destination,
      amount,
      comment: 'R7 admin recovery',
      gasReserve: TESTNET_GAS_RESERVE,
    })

    const nextBalance = Number((currentBalance - amount).toFixed(9))
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: nextBalance })
      .eq('id', targetUserId)

    if (balanceError) throw balanceError

    await recordTransaction(supabase, {
      userId: targetUserId,
      type: 'ton_withdrawal',
      amount: -amount,
      balanceAfter: nextBalance,
      description: `${getTonAssetName()} admin recovery`,
      status: sendResult.pending ? 'pending' : 'confirmed',
      txHash: sendResult.txHash,
    })

    await recordSecurityAudit(supabase, {
      event: 'admin_recovery_succeeded',
      actorUserId: adminUserId,
      targetUserId,
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
      txHash: sendResult.txHash,
      pending: sendResult.pending,
      traceId,
    })
  } catch (error) {
    if (adminUserId || targetUserId) {
      await recordSecurityAudit(getSupabaseAdmin(), {
        event: 'admin_recovery_failed',
        actorUserId: adminUserId || undefined,
        targetUserId: targetUserId || undefined,
        status: 'failed',
        details: {
          traceId,
          reason: error instanceof Error ? error.message : 'admin recovery failed',
        },
      })
    }

    console.error('Admin TON recovery error:', {
      traceId,
      message: error instanceof Error ? error.message : 'admin recovery failed',
    })
    return NextResponse.json({ error: 'Admin recovery failed', traceId }, { status: 400 })
  }
}
