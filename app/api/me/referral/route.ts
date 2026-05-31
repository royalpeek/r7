import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { assertRequestRateLimit } from '@/lib/requestSecurity'

function makeReferralCode(userId: string) {
  const cleanId = userId.replace(/\D/g, '') || userId
  const numericId = Number(cleanId)
  const suffix = Number.isFinite(numericId)
    ? numericId.toString(36).toUpperCase()
    : userId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()

  return `R7${suffix.padStart(6, '0')}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const supabase = getSupabaseAdmin()

    await assertRequestRateLimit(supabase, {
      key: `me-referral:${userId}`,
      limit: 30,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'me_referral' },
    })

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, referral_code, referred_by')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    let referralCode = user.referral_code as string | null

    if (!referralCode) {
      referralCode = makeReferralCode(userId)

      const { error: updateError } = await supabase
        .from('users')
        .update({ referral_code: referralCode })
        .eq('id', userId)

      if (updateError) throw updateError
    }

    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', userId)

    if (countError) throw countError

    return NextResponse.json({
      referralCode,
      referralCount: count ?? 0,
      hasAppliedReferral: Boolean(user.referred_by),
    })
  } catch (error) {
    console.error('Referral info error:', error)
    return NextResponse.json({ error: 'Failed to load referral info' }, { status: 400 })
  }
}
