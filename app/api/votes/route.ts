import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { user_id, poll_id, direction, amount } = body

    if (!poll_id || !direction || !amount) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    poll_id = String(poll_id).trim()
    amount = Number(amount)
    direction = String(direction).toLowerCase()

    console.log('vote request:', { user_id, poll_id, direction, amount })

    // check if user already voted on this poll - use limit instead of single
    const { data: existingVotes, error: fetchVoteError } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', user_id ? String(user_id).trim() : 'anonymous')
      .eq('poll_id', poll_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchVoteError) {
      throw fetchVoteError
    }

    const existingVote = existingVotes && existingVotes.length > 0 ? existingVotes[0] : null

    console.log('existing vote:', existingVote)

    // fetch current poll
    const { data: poll, error: fetchError } = await supabase
      .from('polls')
      .select('yes_pool, no_pool, yes_votes, no_votes, volume')
      .eq('id', poll_id)
      .single()

    if (fetchError) throw fetchError

    let newYesPool = poll.yes_pool || 0
    let newNoPool = poll.no_pool || 0
    let newYesVotes = poll.yes_votes || 0
    let newNoVotes = poll.no_votes || 0
    let newVolume = poll.volume || 0
    let voteId = null

    // if user already voted
    if (existingVote) {
      const oldDirection = existingVote.direction
      const oldAmount = existingVote.amount

      console.log('user already voted:', { oldDirection, oldAmount, newDirection: direction, newAmount: amount })

      // user is changing sides
      if (oldDirection !== direction) {
        console.log('changing sides')
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
      } else {
        // user is adding more to the same side
        console.log('adding more to same side')
        if (direction === 'yes') {
          newYesPool += amount
        } else {
          newNoPool += amount
        }
        newVolume += amount
      }

      // update existing vote
      const { error: updateVoteError } = await supabase
        .from('votes')
        .update({
          amount: oldDirection === direction ? oldAmount + amount : amount,
          direction: direction,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingVote.id)

      if (updateVoteError) throw updateVoteError
      voteId = existingVote.id
      console.log('updated existing vote:', voteId)
    } else {
      // first time voting
      console.log('first time voting')
      const { data: vote, error: voteError } = await supabase
        .from('votes')
        .insert([{
          user_id: user_id ? String(user_id).trim() : 'anonymous',
          poll_id,
          direction,
          amount,
        }])
        .select()

      if (voteError) throw voteError
      voteId = vote[0].id

      // add to pools
      if (direction === 'yes') {
        newYesPool += amount
        newYesVotes += 1
      } else {
        newNoPool += amount
        newNoVotes += 1
      }
      newVolume += amount
      console.log('created new vote:', voteId)
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

    // save poll history snapshot
    const { error: historyError } = await supabase
      .from('poll_history')
      .insert([{
        poll_id,
        yes_pool: newYesPool,
        no_pool: newNoPool,
        yes_votes: newYesVotes,
        no_votes: newNoVotes,
      }])

    if (historyError) {
      console.error('history snapshot error:', historyError)
    }

    console.log('poll updated successfully')
    return NextResponse.json({ 
      success: true,
      vote_id: voteId,
      pools: { yes_pool: newYesPool, no_pool: newNoPool }
    })
  } catch (error) {
    console.error('error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}