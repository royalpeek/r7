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

    // look for an existing vote by this user on the same poll
    const userKey = user_id ? String(user_id).trim() : 'anonymous'
    const { data: existingVotes, error: existingError } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', userKey)
      .eq('poll_id', poll_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingError) throw existingError

    const prevVote = existingVotes && existingVotes.length ? existingVotes[0] : null

    // fetch current poll
    const { data: poll, error: fetchError } = await supabase
      .from('polls')
      .select('yes_pool, no_pool, yes_votes, no_votes, volume')
      .eq('id', poll_id)
      .single()

    if (fetchError) throw fetchError

    const prevDir = prevVote ? String(prevVote.direction).toLowerCase() : null
    const prevAmount = prevVote ? Number(prevVote.amount || 0) : 0

    // determine new poll values accounting for a possible previous vote
    let newYesPool = poll.yes_pool || 0
    let newNoPool = poll.no_pool || 0
    let newYesVotes = poll.yes_votes || 0
    let newNoVotes = poll.no_votes || 0
    let newVolume = poll.volume || 0

    // if user had a previous vote on this poll and changed direction, remove previous contribution
    if (prevVote && prevDir !== direction) {
      if (prevDir === 'yes') {
        newYesPool = Math.max(0, newYesPool - prevAmount)
        newYesVotes = Math.max(0, newYesVotes - 1)
      } else if (prevDir === 'no') {
        newNoPool = Math.max(0, newNoPool - prevAmount)
        newNoVotes = Math.max(0, newNoVotes - 1)
      }
      newVolume = Math.max(0, newVolume - prevAmount)

      // delete the old vote record
      const { error: deleteError } = await supabase.from('votes').delete().eq('id', prevVote.id)
      if (deleteError) throw deleteError
    }

    // now insert the new vote
    const { data: vote, error: voteError } = await supabase
      .from('votes')
      .insert([{ 
        user_id: userKey,
        poll_id,
        direction,
        amount,
      }])
      .select()

    if (voteError) throw voteError

    // apply the new contribution
    if (direction === 'yes') {
      newYesPool = (newYesPool || 0) + amount
      // increment vote count only if user didn't already have a same-direction vote
      if (!prevVote || prevDir !== 'yes') newYesVotes = (newYesVotes || 0) + 1
    } else if (direction === 'no') {
      newNoPool = (newNoPool || 0) + amount
      if (!prevVote || prevDir !== 'no') newNoVotes = (newNoVotes || 0) + 1
    }

    // update volume (add new amount)
    newVolume = (newVolume || 0) + amount

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

    console.log('poll updated successfully')
    return NextResponse.json({ vote: vote[0] })
  } catch (error) {
    console.error('error:', error)
    return NextResponse.json({ error: String(error) }, { status: 400 })
  }
}