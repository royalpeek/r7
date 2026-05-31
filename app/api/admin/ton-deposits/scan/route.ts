import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { scanTonDeposits } from '@/lib/tonDepositScanner'
import { assertRequestRateLimit } from '@/lib/requestSecurity'

async function requireAdmin(initData: string) {
  const telegramUser = getRequestTelegramUser(initData)
  const userId = String(telegramUser.id)
  const supabase = getSupabaseAdmin()

  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) throw error
  if (user?.role !== 'admin') throw new Error('admin access required')

  return { supabase, userId }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { supabase, userId } = await requireAdmin(body.initData)

    await assertRequestRateLimit(supabase, {
      key: `admin-ton-deposit-scan:${userId}`,
      limit: 10,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'admin_ton_deposit_scan' },
    })

    const result = await scanTonDeposits(supabase)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Admin TON deposit scan error:', error)
    return NextResponse.json({ error: 'Failed to scan TON deposits' }, { status: 400 })
  }
}
