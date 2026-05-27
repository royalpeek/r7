import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { closeExpiredMarkets } from '@/lib/marketLifecycle'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = getRequestTelegramUser(body.initData)
    const userId = String(user.id)
    const supabase = getSupabaseAdmin()
    await closeExpiredMarkets(supabase)

    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', userId)

    if (votesError) throw votesError
    if (!votes || votes.length === 0) return NextResponse.json({ positions: [] })

    const pollIds = votes.map(vote => vote.poll_id)
    const { data: polls, error: pollsError } = await supabase
      .from('polls')
      .select('id, question, status, ends_at, yes_pool, no_pool, yes_votes, no_votes')
      .in('id', pollIds)

    if (pollsError) throw pollsError

    const positions = votes.map(vote => {
      const poll = polls?.find(item => item.id === vote.poll_id)

      return {
        id: vote.id,
        poll_id: vote.poll_id,
        question: poll?.question || 'unknown poll',
        direction: vote.direction,
        amount: vote.amount,
        claimed_at: vote.claimed_at || null,
        payout_amount: vote.payout_amount || 0,
        status: poll?.status || 'active',
        ends_at: poll?.ends_at || '',
        created_at: vote.created_at,
        yes_pool: poll?.yes_pool || 0,
        no_pool: poll?.no_pool || 0,
        yes_votes: poll?.yes_votes || 0,
        no_votes: poll?.no_votes || 0,
      }
    })

    return NextResponse.json({ positions })
  } catch (error) {
    console.error('Error fetching user positions:', error)
    return NextResponse.json({ error: 'Failed to fetch user positions' }, { status: 401 })
  }
}
