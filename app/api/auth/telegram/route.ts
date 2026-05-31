import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import {
  isDeviceSecurityDisabled,
  recordDeviceLog,
  registerOrVerifyDevice,
  tryNormalizeDevicePayload,
} from '@/lib/deviceSecurity'
import { assertRateLimit } from '@/lib/rateLimit'
import { recordTransaction } from '@/lib/transactions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { initData } = body
    const telegramUser = getRequestTelegramUser(initData)
    const userId = String(telegramUser.id)
    const username = telegramUser.username || telegramUser.first_name || 'user'
    const supabase = getSupabaseAdmin()
    const deviceSecurityDisabled = isDeviceSecurityDisabled()
    const device = deviceSecurityDisabled ? null : tryNormalizeDevicePayload(body.device)

    await assertRateLimit(supabase, {
      key: `auth:${userId}`,
      limit: 12,
      windowSeconds: 60,
    })

    if (!deviceSecurityDisabled) {
      if (!device) {
        return NextResponse.json({
          error: 'One account is allowed per device. Please reopen the app and try again.',
        }, { status: 401 })
      }

      await assertRateLimit(supabase, {
        key: `auth-device:${device.fingerprint}`,
        limit: 12,
        windowSeconds: 60,
      })
    } else {
      await recordDeviceLog(supabase, {
        event: 'device_security_disabled',
        userId,
        status: 'success',
        details: { phase: 'auth_route' },
      })
    }

    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle()

    if (checkError) throw checkError

    if (!existingUser) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          username,
          balance: 100,
          is_creator: false,
        })
        .select()
        .single()

      if (error) throw error

      await registerOrVerifyDevice(supabase, {
        userId,
        device: body.device,
        isNewUser: true,
      })

      await recordTransaction(supabase, {
        userId,
        type: 'test_credit',
        amount: 100,
        balanceAfter: 100,
        description: 'Test wallet credit',
      })

      return NextResponse.json({ user: data })
    }

    await registerOrVerifyDevice(supabase, {
      userId,
      device: body.device,
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
    console.error('Auth error:', error)
    const message = error instanceof Error ? error.message : 'Auth failed'
    const status = message.includes('Only one account') || message.includes('linked to another device')
      ? 409
      : 401

    return NextResponse.json({ error: message }, { status })
  }
}
