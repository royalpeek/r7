import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { getOrCreateUserTonWallet, getTonAssetName, getTonNetwork, makeTonDepositMemo } from '@/lib/tonWallet'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const wallet = await getOrCreateUserTonWallet(getSupabaseAdmin(), userId)

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
    return NextResponse.json({ error: 'Failed to load TON wallet' }, { status: 400 })
  }
}
