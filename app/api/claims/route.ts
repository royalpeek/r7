import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { closeExpiredMarkets, getMarketLifecycleStatus } from '@/lib/marketLifecycle'

function getWinningDirection(yesVotes: number, noVotes: number) {
  if (yesVotes > noVotes) return 'yes'
  if (noVotes > yesVotes) return 'no'
  return 'draw'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const telegramUser = getRequestTelegramUser(body.initData)
    const userId = String(telegramUser.id)
    const pollId = String(body.poll_id || '').trim()
    const supabase = getSupabaseAdmin()

    if (!pollId) {
      return NextResponse.json({ error: 'missing poll id' }, { status: 400 })
    }

    await closeExpiredMarkets(supabase)

    const { data: vote, error: voteError } = await supabase
      .from('votes')
      .select('id, user_id, poll_id, direction, amount, claimed_at')
      .eq('user_id', userId)
      .eq('poll_id', pollId)
      .single()

    if (voteError) throw voteError
    if (vote.claimed_at) {
      return NextResponse.json({ error: 'already claimed' }, { status: 400 })
    }

    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('status, ends_at, yes_pool, no_pool, yes_votes, no_votes')
      .eq('id', pollId)
      .single()

    if (pollError) throw pollError

    const lifecycleStatus = getMarketLifecycleStatus(poll.status, poll.ends_at)
    if (lifecycleStatus === 'live' || lifecycleStatus === 'paused') {
      return NextResponse.json({ error: 'market has not ended' }, { status: 400 })
    }
    if (lifecycleStatus === 'archived') {
      return NextResponse.json({ error: 'market is archived' }, { status: 400 })
    }

    const yesVotes = Number(poll.yes_votes || 0)
    const noVotes = Number(poll.no_votes || 0)
    const yesPool = Number(poll.yes_pool || 0)
    const noPool = Number(poll.no_pool || 0)
    const voteAmount = Number(vote.amount || 0)
    const winningDirection = getWinningDirection(yesVotes, noVotes)

    if (winningDirection !== 'draw' && vote.direction !== winningDirection) {
      return NextResponse.json({ error: 'this vote did not win' }, { status: 400 })
    }

    const winningPool = winningDirection === 'draw'
      ? voteAmount
      : winningDirection === 'yes'
        ? yesPool
        : noPool
    const totalPool = yesPool + noPool
    const rawPayout = winningDirection === 'draw'
      ? voteAmount
      : winningPool > 0
        ? (voteAmount / winningPool) * totalPool
        : 0
    const payout = Number(rawPayout.toFixed(2))

    if (!Number.isFinite(payout) || payout <= 0) {
      return NextResponse.json({ error: 'nothing to claim' }, { status: 400 })
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()

    if (userError) throw userError

    const currentBalance = Number(user.balance ?? 0)
    if (!Number.isFinite(currentBalance)) throw new Error('invalid user balance')

    const claimedAt = new Date().toISOString()
    const { error: claimError } = await supabase
      .from('votes')
      .update({ claimed_at: claimedAt, payout_amount: payout })
      .eq('id', vote.id)
      .is('claimed_at', null)

    if (claimError) throw claimError

    const nextBalance = Number((currentBalance + payout).toFixed(2))
    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: nextBalance })
      .eq('id', userId)

    if (balanceError) throw balanceError

    return NextResponse.json({
      success: true,
      payout,
      balance: nextBalance,
      claimedAt,
    })
  } catch (error) {
    console.error('Claim error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'claim failed' }, { status: 400 })
  }
}
