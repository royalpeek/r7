import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { resolveUserIdentifier, unlockUserDevice } from '@/lib/deviceSecurity'
import { recordSecurityAudit } from '@/lib/securityAudit'
import { assertRequestRateLimit, getRequestFingerprint } from '@/lib/requestSecurity'

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
  const requestFingerprint = getRequestFingerprint(request)
  let adminUserId: string | null = null
  let targetUserId: string | null = null

  try {
    const body = await request.json()
    const identifier = String(body.userId || body.telegramId || body.identifier || '').trim()

    if (!identifier) {
      return NextResponse.json({ error: 'User identifier is required' }, { status: 400 })
    }

    const auth = await requireAdmin(body.initData)
    const supabase = auth.supabase
    adminUserId = auth.adminUserId

    await assertRequestRateLimit(supabase, {
      key: `admin-unlock:${adminUserId}`,
      limit: 8,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: adminUserId,
      details: { phase: 'admin_unlock_device', requestFingerprint },
    })

    const resolvedTargetUserId = await resolveUserIdentifier(supabase, identifier)
    targetUserId = resolvedTargetUserId

    const result = await unlockUserDevice(supabase, {
      targetUserId: resolvedTargetUserId,
      adminUserId,
    })

    await recordSecurityAudit(supabase, {
      event: 'admin_unlock_device',
      actorUserId: adminUserId,
      targetUserId: resolvedTargetUserId,
      details: {
        reason: 'admin_device_reset',
        action: result.clearedOwnerUserId ? 'cleared_target_and_owner_device' : 'cleared_target_device',
        clearedOwnerUserId: result.clearedOwnerUserId,
      },
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
    if (adminUserId || targetUserId) {
      await recordSecurityAudit(getSupabaseAdmin(), {
        event: 'admin_endpoint_denied',
        actorUserId: adminUserId || undefined,
        targetUserId: targetUserId || undefined,
        status: 'failed',
        details: {
          endpoint: 'admin_unlock_device',
          reason: error instanceof Error ? error.message : 'unlock failed',
          requestFingerprint,
        },
      })
    }
    console.error('Admin unlock device error:', {
      adminUserId,
      targetUserId,
      message: error instanceof Error ? error.message : 'unlock failed',
    })
    const message = error instanceof Error ? error.message : 'Failed to unlock device'
    const status = message === 'User not found' ? 404 : 403
    return NextResponse.json({ error: message }, { status })
  }
}
