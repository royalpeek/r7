import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { assertUserDevice } from '@/lib/deviceSecurity'
import { assertRequestRateLimit } from '@/lib/requestSecurity'

const voteDirections = ['yes', 'no'] as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = getRequestTelegramUser(body.initData)
    const userId = String(user.id)
    const { poll_id, old_direction, new_direction, new_amount } = body
    const supabase = getSupabaseAdmin()

    await assertUserDevice(supabase, {
      userId,
      device: body.device,
      event: 'user_action_checked',
    })

    await assertRequestRateLimit(supabase, {
      key: `change-vote:${userId}`,
      limit: 10,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'change_vote' },
    })

    if (!poll_id || !old_direction || !new_direction || !new_amount) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    const newAmount = Number(new_amount)
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
    }
    if (!voteDirections.includes(old_direction) || !voteDirections.includes(new_direction)) {
      return NextResponse.json({ error: 'invalid vote direction' }, { status: 400 })
    }

    const fee = newAmount * 0.005 // 0.5% fee
    const stakeAmount = newAmount - fee

    // get old vote
    const { data: oldVote, error: oldVoteError } = await supabase
      .from('votes')
      .select('amount')
      .eq('user_id', userId)
      .eq('poll_id', poll_id)
      .eq('direction', old_direction)
      .single()

    if (oldVoteError) throw oldVoteError
    const oldAmount = oldVote.amount

    // delete old vote
    const { error: deleteError } = await supabase
      .from('votes')
      .delete()
      .eq('user_id', userId)
      .eq('poll_id', poll_id)
      .eq('direction', old_direction)

    if (deleteError) throw deleteError

    // create new vote with new direction
    const { error: createVoteError } = await supabase
      .from('votes')
      .insert([{
        user_id: userId,
        poll_id,
        direction: new_direction,
        amount: stakeAmount,
      }])

    if (createVoteError) throw createVoteError

    // get current poll
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('yes_pool, no_pool, yes_votes, no_votes, volume')
      .eq('id', poll_id)
      .single()

    if (pollError) throw pollError

    // calculate new poll values
    let newYesPool = poll.yes_pool || 0
    let newNoPool = poll.no_pool || 0
    let newYesVotes = poll.yes_votes || 0
    let newNoVotes = poll.no_votes || 0
    let newVolume = poll.volume || 0

    // remove old amount from old pool
    if (old_direction === 'yes') {
      newYesPool -= oldAmount
      newYesVotes -= 1
    } else {
      newNoPool -= oldAmount
      newNoVotes -= 1
    }

    newVolume -= oldAmount

    // add new amount to new pool
    if (new_direction === 'yes') {
      newYesPool += stakeAmount
      newYesVotes += 1
    } else {
      newNoPool += stakeAmount
      newNoVotes += 1
    }

    newVolume += stakeAmount

    // update poll
    const { error: updatePollError } = await supabase
      .from('polls')
      .update({
        yes_pool: newYesPool,
        no_pool: newNoPool,
        yes_votes: newYesVotes,
        no_votes: newNoVotes,
        volume: newVolume,
      })
      .eq('id', poll_id)

    if (updatePollError) throw updatePollError

    // send fee to treasury and return amount to user
    const refundAmount = oldAmount - newAmount

    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()

    if (userDataError) throw userDataError
    const currentUserBalance = Number(userData.balance ?? 0)
    if (Number.isNaN(currentUserBalance)) throw new Error('invalid user balance')

    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ balance: currentUserBalance + refundAmount })
      .eq('id', userId)

    if (userUpdateError) throw userUpdateError

    // add fee to treasury
    const treasuryId = '7b60d2ab-e0e9-4461-8c1a-c0d1b388b911' // replace with your treasury UUID
    const { data: treasuryData, error: treasuryDataError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', treasuryId)
      .single()

    if (treasuryDataError) throw treasuryDataError
    const currentTreasuryBalance = Number(treasuryData.balance ?? 0)
    if (Number.isNaN(currentTreasuryBalance)) throw new Error('invalid treasury balance')

    const { error: treasuryError } = await supabase
      .from('users')
      .update({ balance: currentTreasuryBalance + fee })
      .eq('id', treasuryId)

    if (treasuryError) throw treasuryError

    return NextResponse.json({ success: true, refund: refundAmount, fee })
  } catch (error) {
    console.error('change vote error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Change vote failed',
    }, { status: 400 })
  }
}
