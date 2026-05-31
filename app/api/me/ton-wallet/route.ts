import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { assertUserDevice } from '@/lib/deviceSecurity'
import { assertRequestRateLimit } from '@/lib/requestSecurity'
import { getOrCreateUserTonWallet, getTonAssetName, getTonNetwork, makeTonDepositMemo } from '@/lib/tonWallet'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const supabase = getSupabaseAdmin()

    await assertRequestRateLimit(supabase, {
      key: `ton-wallet:${userId}`,
      limit: 10,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'ton_wallet_load_or_create' },
    })
    await assertUserDevice(supabase, {
      userId,
      device: body.device,
      event: 'wallet_creation_checked',
    })

    const wallet = await getOrCreateUserTonWallet(supabase, userId)

    return NextResponse.json({
      network: getTonNetwork(),
      asset: getTonAssetName(),
      address: wallet.address,
      memo: makeTonDepositMemo(userId),
      memoRequired: false,
      configured: Boolean(wallet.address),
    })
  } catch (error) {
    console.error('TON wallet info error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to load TON wallet',
    }, { status: 400 })
  }
}
