import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = getRequestTelegramUser(body.initData)
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('users')
      .select('balance')
      .eq('id', String(user.id))
      .single()

    if (error) throw error

    return NextResponse.json({ balance: Number(data.balance ?? 0) })
  } catch (error) {
    console.error('Balance error:', error)
    return NextResponse.json({ error: 'Failed to fetch balance' }, { status: 400 })
  }
}
