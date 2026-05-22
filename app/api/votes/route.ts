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

    // create vote first
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

    // fetch current poll
    const { data: poll, error: fetchError } = await supabase
      .from('polls')
      .select('yes_pool, no_pool, yes_votes, no_votes, volume')
      .eq('id', poll_id)
      .single()

    if (fetchError) throw fetchError

    // calculate new values
    const newYesPool = direction === 'yes' ? (poll.yes_pool || 0) + amount : poll.yes_pool || 0
    const newNoPool = direction === 'no' ? (poll.no_pool || 0) + amount : poll.no_pool || 0
    const newYesVotes = direction === 'yes' ? (poll.yes_votes || 0) + 1 : poll.yes_votes || 0
    const newNoVotes = direction === 'no' ? (poll.no_votes || 0) + 1 : poll.no_votes || 0
    const newVolume = (poll.volume || 0) + amount

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