import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { normalizeDevicePayload, recordDeviceLog, registerOrVerifyDevice } from '@/lib/deviceSecurity'
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
    const device = normalizeDevicePayload(body.device)

    await assertRateLimit(supabase, {
      key: `auth:${userId}`,
      limit: 12,
      windowSeconds: 60,
    })
    await assertRateLimit(supabase, {
      key: `auth-device:${device.fingerprint}`,
      limit: 12,
      windowSeconds: 60,
    })

    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') throw checkError

    if (!existingUser) {
      const { data: deviceOwner, error: deviceOwnerError } = await supabase
        .from('devices')
        .select('user_id')
        .eq('device_fingerprint', device.fingerprint)
        .maybeSingle()

      if (deviceOwnerError) throw deviceOwnerError

      if (deviceOwner) {
        await recordDeviceLog(supabase, {
          event: 'multiple_account_blocked',
          userId,
          fingerprint: device.fingerprint,
          status: 'blocked',
          details: { ownerUserId: deviceOwner.user_id },
        })
        return NextResponse.json({
          error: 'Only one account is allowed per device and Telegram ID.',
        }, { status: 409 })
      }

      const { data, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          telegram_id: userId,
          username,
          balance: 100,
          is_creator: false,
        })
        .select()
        .single()

      if (error) throw error
      await registerOrVerifyDevice(supabase, { userId, device, isNewUser: true })
      await recordTransaction(supabase, {
        userId,
        type: 'test_credit',
        amount: 100,
        balanceAfter: 100,
        description: 'Test wallet credit',
      })
      return NextResponse.json({ user: data })
    }

    await registerOrVerifyDevice(supabase, { userId, device, isNewUser: false })

    const { data, error } = await supabase
      .from('users')
      .update({ username, telegram_id: userId })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ user: data })
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Auth failed',
    }, { status: 401 })
  }
}
