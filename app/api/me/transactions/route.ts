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
      key: `me-transactions:${userId}`,
      limit: 45,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'me_transactions' },
    })

    let transactions: unknown[] | null = null
    let queryError: { message: string } | null = null

    const primary = await supabase
      .from('user_transactions')
      .select('id, type, amount, balance_after, poll_id, description, status, tx_hash, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    transactions = primary.data
    queryError = primary.error

    if (queryError && (queryError.message.includes('status') || queryError.message.includes('tx_hash'))) {
      const fallback = await supabase
        .from('user_transactions')
        .select('id, type, amount, balance_after, poll_id, description, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      transactions = fallback.data
      queryError = fallback.error
    }

    if (queryError) throw queryError

    return NextResponse.json({ transactions: transactions || [] })
  } catch (error) {
    console.error('Transactions error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 400 })
  }
}
