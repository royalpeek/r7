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
