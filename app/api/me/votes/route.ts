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
      key: `me-votes:${userId}`,
      limit: 60,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'me_votes' },
    })

    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    return NextResponse.json({ votes: data || [] })
  } catch (error) {
    console.error('Error fetching user votes:', error)
    return NextResponse.json({ error: 'Failed to fetch user votes' }, { status: 401 })
  }
}
