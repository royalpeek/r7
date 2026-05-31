import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { assertRequestRateLimit } from '@/lib/requestSecurity'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = getRequestTelegramUser(body.initData)
    const userId = String(user.id)
    const supabase = getSupabaseAdmin()

    await assertRequestRateLimit(supabase, {
      key: `me-balance:${userId}`,
      limit: 60,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'me_balance' },
    })

    const { data, error } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()

    if (error) throw error

    return NextResponse.json({ balance: Number(data.balance ?? 0) })
  } catch (error) {
    console.error('Balance error:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 400 })
  }
}
