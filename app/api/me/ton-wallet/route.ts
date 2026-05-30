import { NextRequest, NextResponse } from 'next/server'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { getTonAssetName, getTonNetwork, makeTonDepositMemo } from '@/lib/tonWallet'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const custodyAddress = process.env.TON_CUSTODY_DEPOSIT_ADDRESS || ''

    return NextResponse.json({
      network: getTonNetwork(),
      asset: getTonAssetName(),
      address: custodyAddress,
      memo: makeTonDepositMemo(String(telegramUser.id)),
      configured: Boolean(custodyAddress),
    })
  } catch (error) {
    console.error('TON wallet info error:', error)
    return NextResponse.json({ error: 'Failed to load TON wallet' }, { status: 400 })
  }
}
