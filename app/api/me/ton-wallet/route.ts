import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getRequestTelegramUser } from '@/lib/telegramAuth'

function makeDepositMemo(userId: string) {
  const secret = process.env.TON_CUSTODY_MEMO_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'r7-dev-secret'
  const digest = crypto
    .createHmac('sha256', secret)
    .update(userId)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase()

  return `R7-${digest}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const custodyAddress = process.env.TON_CUSTODY_DEPOSIT_ADDRESS || ''

    return NextResponse.json({
      network: process.env.TON_NETWORK || 'mainnet',
      asset: 'USDT on TON',
      address: custodyAddress,
      memo: makeDepositMemo(String(telegramUser.id)),
      configured: Boolean(custodyAddress),
    })
  } catch (error) {
    console.error('TON wallet info error:', error)
    return NextResponse.json({ error: 'Failed to load TON wallet' }, { status: 400 })
  }
}
