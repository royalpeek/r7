import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import {
  isDeviceSecurityDisabled,
  recordDeviceLog,
  registerOrVerifyDevice,
  tryNormalizeDevicePayload,
} from '@/lib/deviceSecurity'
import { recordSecurityAudit } from '@/lib/securityAudit'
import {
  assertRequestRateLimit,
  classifyTelegramAuthError,
  getRequestFingerprint,
} from '@/lib/requestSecurity'

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin()
  const requestFingerprint = getRequestFingerprint(request)
  let body: Record<string, unknown> = {}
  let auditUserId: string | undefined

  try {
    body = await request.json()
    const initData = typeof body.initData === 'string' ? body.initData : undefined

    await assertRequestRateLimit(supabase, {
      key: `auth-request:${requestFingerprint}`,
      limit: 30,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      details: { phase: 'telegram_auth', requestFingerprint },
    })

    const telegramUser = getRequestTelegramUser(initData)
    const userId = String(telegramUser.id)
    auditUserId = userId
    const username = telegramUser.username || telegramUser.first_name || 'user'
    const deviceSecurityDisabled = isDeviceSecurityDisabled()
    const device = deviceSecurityDisabled ? null : tryNormalizeDevicePayload(
      body.device as Parameters<typeof tryNormalizeDevicePayload>[0]
    )

    await assertRequestRateLimit(supabase, {
      key: `auth:${userId}`,
      limit: 12,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'telegram_auth_user' },
    })

    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle()

    if (checkError) throw checkError

    const isExistingAdmin = existingUser?.role === 'admin'

    if (!deviceSecurityDisabled) {
      if (!device && !isExistingAdmin) {
        await recordDeviceLog(supabase, {
          event: 'login_blocked',
          userId,
          status: 'blocked',
          details: { reason: 'missing_or_invalid_device_payload' },
        })
        return NextResponse.json({
          error: 'One account is allowed per device. Please reopen the app and try again.',
        }, { status: 401 })
      }

      if (device) {
        await assertRequestRateLimit(supabase, {
          key: `auth-device:${device.fingerprint}`,
          limit: 12,
          windowSeconds: 60,
          auditEvent: 'suspicious_rate_limit',
          actorUserId: userId,
          details: { phase: 'telegram_auth_device' },
        })
      }
    } else {
      await recordDeviceLog(supabase, {
        event: 'device_security_disabled',
        userId,
        status: 'success',
        details: { phase: 'auth_route' },
      })
      await recordSecurityAudit(supabase, {
        event: 'emergency_device_bypass_active',
        actorUserId: userId,
        details: { phase: 'auth_route' },
      })
    }

    if (!existingUser) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          username,
          balance: 0,
          is_creator: false,
        })
        .select()
        .single()

      if (error) throw error

      await registerOrVerifyDevice(supabase, {
        userId,
        device: body.device as Parameters<typeof registerOrVerifyDevice>[1]['device'],
        isNewUser: true,
      })

      return NextResponse.json({ user: data })
    }

    await registerOrVerifyDevice(supabase, {
      userId,
      device: body.device as Parameters<typeof registerOrVerifyDevice>[1]['device'],
      isNewUser: false,
    })

    const { data, error } = await supabase
      .from('users')
      .update({ username })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ user: data })
  } catch (error) {
    const reason = classifyTelegramAuthError(error)
    if (reason !== 'telegram_auth_failed' || !auditUserId) {
      await recordSecurityAudit(supabase, {
        event: reason === 'expired_telegram_auth' ? 'telegram_auth_expired' : 'telegram_auth_failed',
        actorUserId: auditUserId,
        status: 'failed',
        details: {
          reason,
          requestFingerprint,
        },
      })
    }

    console.error('Auth error:', {
      reason,
      userId: auditUserId,
    })
    const message = error instanceof Error ? error.message : 'Auth failed'
    const status = message.includes('Only one account') || message.includes('linked to another device')
      ? 409
      : 401

    return NextResponse.json({ error: message }, { status })
  }
}
