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
      key: `me-stats:${userId}`,
      limit: 60,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'me_stats' },
    })

    const { count, error } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ totalVotes: count ?? 0 })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 401 })
  }
}
