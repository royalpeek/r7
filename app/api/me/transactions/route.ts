import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = getRequestTelegramUser(body.initData)
    const userId = String(user.id)
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('user_transactions')
      .select('id, type, amount, balance_after, poll_id, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ transactions: data || [] })
  } catch (error) {
    console.error('Transactions error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 400 })
  }
}
