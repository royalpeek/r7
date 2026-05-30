import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { scanTonDeposits } from '@/lib/tonDepositScanner'

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) return process.env.NODE_ENV !== 'production'

  const bearerToken = request.headers.get('authorization') === `Bearer ${cronSecret}`
  const headerToken = request.headers.get('x-cron-secret') === cronSecret
  const queryToken = request.nextUrl.searchParams.get('secret') === cronSecret

  return bearerToken || headerToken || queryToken
}

async function runCronScan(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await scanTonDeposits(getSupabaseAdmin())
    return NextResponse.json(result)
  } catch (error) {
    console.error('TON deposit scan error:', error)
    return NextResponse.json({ error: 'TON deposit scan failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return runCronScan(request)
}

export async function POST(request: NextRequest) {
  return runCronScan(request)
}
