import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { closeExpiredMarkets, getMarketLifecycleStatus } from '@/lib/marketLifecycle'
import { assertRequestRateLimit } from '@/lib/requestSecurity'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = getRequestTelegramUser(body.initData)
    const userId = String(user.id)
    const supabase = getSupabaseAdmin()

    await assertRequestRateLimit(supabase, {
      key: `me-creator-stats:${userId}`,
      limit: 30,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'me_creator_stats' },
    })

    await closeExpiredMarkets(supabase)

    const { data: appUser, error: userError } = await supabase
      .from('users')
      .select('role, is_creator')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const role = appUser?.role || (appUser?.is_creator ? 'creator' : 'user')
    if (role !== 'creator' && role !== 'admin') {
      return NextResponse.json({ stats: null, polls: [] })
    }

    const { data: polls, error: pollsError } = await supabase
      .from('polls')
      .select('id, question, category, status, yes_pool, no_pool, yes_votes, no_votes, ends_at, created_at, creator_reward_amount, creator_reward_paid_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (pollsError) throw pollsError

    const creatorPolls = polls || []
    const resolvedPolls = creatorPolls.filter(poll => {
      const status = getMarketLifecycleStatus(poll.status, poll.ends_at)
      return status === 'ended' || status === 'closed'
    })
    const pendingPolls = creatorPolls.filter(poll => {
      const status = getMarketLifecycleStatus(poll.status, poll.ends_at)
      return status === 'live' || status === 'paused'
    })

    const totalFees = creatorPolls.reduce((sum, poll) => sum + Number(poll.creator_reward_amount || 0), 0)
    const totalPool = creatorPolls.reduce((sum, poll) => {
      return sum + Number(poll.yes_pool || 0) + Number(poll.no_pool || 0)
    }, 0)
    const totalVotes = creatorPolls.reduce((sum, poll) => {
      return sum + Number(poll.yes_votes || 0) + Number(poll.no_votes || 0)
    }, 0)
    const topPoll = creatorPolls.reduce<typeof creatorPolls[number] | null>((best, poll) => {
      if (!best) return poll
      return Number(poll.creator_reward_amount || 0) > Number(best.creator_reward_amount || 0) ? poll : best
    }, null)

    return NextResponse.json({
      stats: {
        totalFees: Number(totalFees.toFixed(2)),
        totalPolls: creatorPolls.length,
        resolvedPolls: resolvedPolls.length,
        pendingPolls: pendingPolls.length,
        avgPool: creatorPolls.length > 0 ? Number((totalPool / creatorPolls.length).toFixed(2)) : 0,
        avgVotes: creatorPolls.length > 0 ? Math.round(totalVotes / creatorPolls.length) : 0,
        topPollReward: Number(topPoll?.creator_reward_amount || 0),
        topPollQuestion: topPoll?.question || '',
      },
      polls: creatorPolls,
    })
  } catch (error) {
    console.error('Creator stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch creator stats' }, { status: 400 })
  }
}
