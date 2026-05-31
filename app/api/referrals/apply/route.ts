import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { assertRequestRateLimit } from '@/lib/requestSecurity'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const code = String(body.code || '').trim().toUpperCase()
    const supabase = getSupabaseAdmin()

    await assertRequestRateLimit(supabase, {
      key: `referral-apply:${userId}`,
      limit: 10,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'referral_apply' },
    })

    if (!code) {
      return NextResponse.json({ error: 'Enter a referral code' }, { status: 400 })
    }

    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('id, referred_by, referral_code')
      .eq('id', userId)
      .single()

    if (currentUserError) throw currentUserError

    if (currentUser.referred_by) {
      return NextResponse.json({ error: 'Referral code already applied' }, { status: 400 })
    }

    if (currentUser.referral_code === code) {
      return NextResponse.json({ error: 'You cannot use your own referral code' }, { status: 400 })
    }

    const { data: referrer, error: referrerError } = await supabase
      .from('users')
      .select('id, username')
      .eq('referral_code', code)
      .single()

    if (referrerError || !referrer) {
      return NextResponse.json({ error: 'Referral code not found' }, { status: 404 })
    }

    if (referrer.id === userId) {
      return NextResponse.json({ error: 'You cannot use your own referral code' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        referred_by: referrer.id,
        referral_applied_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      referrer: {
        id: referrer.id,
        username: referrer.username,
      },
    })
  } catch (error) {
    console.error('Apply referral error:', error)
    return NextResponse.json({ error: 'Failed to apply referral code' }, { status: 400 })
  }
}
