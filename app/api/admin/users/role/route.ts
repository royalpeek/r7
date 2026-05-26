import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'

const allowedRoles = ['user', 'creator', 'admin'] as const
type Role = (typeof allowedRoles)[number]

async function getAdminUserId(initData: string) {
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

  return { supabase, adminUserId: userId }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const targetUserId = String(body.userId || '')
    const role = body.role as Role

    if (!targetUserId || !allowedRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role update' }, { status: 400 })
    }

    const { supabase, adminUserId } = await getAdminUserId(body.initData)

    if (targetUserId === adminUserId && role !== 'admin') {
      return NextResponse.json({ error: 'You cannot remove your own admin role' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        role,
        is_creator: role === 'creator' || role === 'admin',
      })
      .eq('id', targetUserId)
      .select('id, username, balance, role, is_creator, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Admin role update error:', error)
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
}
