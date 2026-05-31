import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { resolveUserIdentifier, unlockUserDevice } from '@/lib/deviceSecurity'

async function requireAdmin(initData: string) {
  const telegramUser = getRequestTelegramUser(initData)
  const adminUserId = String(telegramUser.id)
  const supabase = getSupabaseAdmin()

  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', adminUserId)
    .single()

  if (error) throw error
  if (user?.role !== 'admin') throw new Error('admin access required')

  return { supabase, adminUserId }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const identifier = String(body.userId || body.telegramId || body.identifier || '').trim()

    if (!identifier) {
      return NextResponse.json({ error: 'User identifier is required' }, { status: 400 })
    }

    const { supabase, adminUserId } = await requireAdmin(body.initData)
    const targetUserId = await resolveUserIdentifier(supabase, identifier)

    const result = await unlockUserDevice(supabase, {
      targetUserId,
      adminUserId,
    })

    let message = 'Device registration cleared. Ask them to reopen R7.'
    if (result.clearedOwnerUserId) {
      message = `Device released from user ${result.clearedOwnerUserId}. ${targetUserId} can log in on this device now. Your admin account is not blocked by device rules.`
    } else if (!result.hadTargetDevice) {
      message = `No device was on file for ${targetUserId}. If they are still locked, use this same reset box with the account that currently owns the device.`
    }

    return NextResponse.json({
      ok: true,
      userId: targetUserId,
      clearedOwnerUserId: result.clearedOwnerUserId,
      message,
    })
  } catch (error) {
    console.error('Admin unlock device error:', error)
    const message = error instanceof Error ? error.message : 'Failed to unlock device'
    const status = message === 'User not found' ? 404 : 403
    return NextResponse.json({ error: message }, { status })
  }
}
