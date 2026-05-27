import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { CREATOR_DAILY_POLL_LIMIT, getLagosDayWindow } from '@/lib/creatorQuota'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const supabase = getSupabaseAdmin()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role, is_creator')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const role = user?.role || (user?.is_creator ? 'creator' : 'user')
    const isAdmin = role === 'admin'
    const canCreate = role === 'creator' || isAdmin

    if (!canCreate) {
      return NextResponse.json({
        canCreate: false,
        isAdmin: false,
        limit: 0,
        used: 0,
        remaining: 0,
      })
    }

    if (isAdmin) {
      return NextResponse.json({
        canCreate: true,
        isAdmin: true,
        limit: null,
        used: 0,
        remaining: null,
      })
    }

    const { startIso, endIso } = getLagosDayWindow()
    const { count, error: countError } = await supabase
      .from('polls')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId)
      .gte('created_at', startIso)
      .lt('created_at', endIso)

    if (countError) throw countError

    const used = count ?? 0
    const remaining = Math.max(0, CREATOR_DAILY_POLL_LIMIT - used)

    return NextResponse.json({
      canCreate: remaining > 0,
      isAdmin: false,
      limit: CREATOR_DAILY_POLL_LIMIT,
      used,
      remaining,
    })
  } catch (error) {
    console.error('Creator quota error:', error)
    return NextResponse.json({ error: 'Failed to load creator quota' }, { status: 400 })
  }
}
