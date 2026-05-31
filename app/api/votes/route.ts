import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { recordTransaction } from '@/lib/transactions'

function money(value: number) {
  return Number(value.toFixed(2))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const user = getRequestTelegramUser(body.initData)
    const userId = String(user.id)
    let { poll_id, direction, amount } = body
    const supabase = getSupabaseAdmin()

    if (!poll_id || !direction || !amount) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    poll_id = String(poll_id).trim()
    amount = Number(amount)
    direction = String(direction).toLowerCase()

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'invalid amount' }, { status: 400 })
    }

    if (direction !== 'yes' && direction !== 'no') {
      return NextResponse.json({ error: 'invalid vote direction' }, { status: 400 })
    }

    console.log('vote request:', { userId, poll_id, direction, amount })

    // check if user already voted on this poll
    const { data: existingVote, error: fetchVoteError } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', userId)
      .eq('poll_id', poll_id)
      .single()

    if (fetchVoteError && fetchVoteError.code !== 'PGRST116') {
      throw fetchVoteError
    }

    // fetch current poll
    const { data: poll, error: fetchError } = await supabase
      .from('polls')
      .select('yes_pool, no_pool, yes_votes, no_votes, volume, ends_at, status')
      .eq('id', poll_id)
      .single()

    if (fetchError) throw fetchError
    if (poll.status === 'paused') {
      return NextResponse.json({ error: 'market is paused' }, { status: 400 })
    }
    if (poll.status === 'closed') {
      return NextResponse.json({ error: 'market is closed' }, { status: 400 })
    }
    if (poll.status === 'archived') {
      return NextResponse.json({ error: 'market is archived' }, { status: 400 })
    }
    if (poll.ends_at && new Date(poll.ends_at) <= new Date()) {
      return NextResponse.json({ error: 'market has ended' }, { status: 400 })
    }

    const fee = money(amount * 0.01)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()

    if (userError) throw userError
    const currentBalance = Number(userData.balance ?? 0)
    if (!Number.isFinite(currentBalance)) throw new Error('invalid user balance')

    let newYesPool = poll.yes_pool || 0
    let newNoPool = poll.no_pool || 0
    let newYesVotes = poll.yes_votes || 0
    let newNoVotes = poll.no_votes || 0
    let newVolume = poll.volume || 0
    let voteId = null
    let balanceDelta = money(-(amount + fee))
    let stakeTransactionAmount = -amount
    let stakeTransactionDescription = `${direction.toUpperCase()} stake`
    let nextVoteAmount = amount

    // if user already voted
    if (existingVote) {
      const oldDirection = existingVote.direction
      const oldAmount = Number(existingVote.amount || 0)

      // user is changing sides
      if (oldDirection !== direction) {
        // remove old amount from old pool
        if (oldDirection === 'yes') {
          newYesPool -= oldAmount
          newYesVotes -= 1
        } else {
          newNoPool -= oldAmount
          newNoVotes -= 1
        }

        // add new amount to new pool
        if (direction === 'yes') {
          newYesPool += amount
          newYesVotes += 1
        } else {
          newNoPool += amount
          newNoVotes += 1
        }

        newVolume = newVolume - oldAmount + amount
        balanceDelta = money(oldAmount - amount - fee)
        stakeTransactionAmount = money(oldAmount - amount)
        stakeTransactionDescription = stakeTransactionAmount >= 0
          ? 'Stake difference refunded'
          : `${direction.toUpperCase()} stake increase`
      } else {
        // user is adding more to the same side
        nextVoteAmount = money(oldAmount + amount)
        if (direction === 'yes') {
          newYesPool += amount
        } else {
          newNoPool += amount
        }
        newVolume += amount
      }
    } else {
      // add to pools
      if (direction === 'yes') {
        newYesPool += amount
        newYesVotes += 1
      } else {
        newNoPool += amount
        newNoVotes += 1
      }
      newVolume += amount
    }

    const nextBalance = money(currentBalance + balanceDelta)
    if (nextBalance < 0) {
      return NextResponse.json({ error: 'insufficient balance' }, { status: 400 })
    }

    if (existingVote) {
      const { error: updateVoteError } = await supabase
        .from('votes')
        .update({
          amount: nextVoteAmount,
          direction,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingVote.id)

      if (updateVoteError) throw updateVoteError
      voteId = existingVote.id
    } else {
      const { data: vote, error: voteError } = await supabase
        .from('votes')
        .insert([{
          user_id: userId,
          poll_id,
          direction,
          amount,
        }])
        .select()

      if (voteError) throw voteError
      voteId = vote[0].id
    }

    console.log('updating poll:', { newYesPool, newNoPool, newYesVotes, newNoVotes, newVolume })

    // update poll
    const { error: updateError } = await supabase
      .from('polls')
      .update({
        yes_pool: newYesPool,
        no_pool: newNoPool,
        yes_votes: newYesVotes,
        no_votes: newNoVotes,
        volume: newVolume,
      })
      .eq('id', poll_id)

    if (updateError) throw updateError

    const { error: historyError } = await supabase
      .from('poll_history')
      .insert({
        poll_id,
        yes_pool: newYesPool,
        no_pool: newNoPool,
      })

    if (historyError) {
      console.error('poll history insert error:', historyError)
    }

    const { error: balanceError } = await supabase
      .from('users')
      .update({ balance: nextBalance })
      .eq('id', userId)

    if (balanceError) throw balanceError

    await Promise.all([
      recordTransaction(supabase, {
        userId,
        type: 'stake',
        amount: stakeTransactionAmount,
        balanceAfter: nextBalance,
        pollId: poll_id,
        description: stakeTransactionDescription,
      }),
      recordTransaction(supabase, {
        userId,
        type: 'fee',
        amount: -fee,
        balanceAfter: nextBalance,
        pollId: poll_id,
        description: 'Voting fee',
      }),
    ])

    console.log('poll updated successfully')
    return NextResponse.json({ 
      success: true,
      vote_id: voteId,
      pools: { yes_pool: newYesPool, no_pool: newNoPool },
      balance: nextBalance,
    })
  } catch (error) {
    console.error('error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}
