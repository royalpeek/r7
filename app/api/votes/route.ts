import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, poll_id, direction, amount } = body

    if (!user_id || !poll_id || !direction || !amount) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    // create vote
    const { data: vote, error: voteError } = await supabase
      .from('votes')
      .insert([{ user_id, poll_id, direction, amount }])
      .select()

    if (voteError) throw voteError

    // get current poll data
    const { data: pollData, error: pollError } = await supabase
      .from('polls')
      .select('yes_pool, no_pool, yes_votes, no_votes, volume')
      .eq('id', poll_id)
      .single()

    if (pollError) throw pollError

    // update poll totals
    const poolKey = direction === 'yes' ? 'yes_pool' : 'no_pool'
    const votesKey = direction === 'yes' ? 'yes_votes' : 'no_votes'

    const updatedPool = (pollData[poolKey] || 0) + amount
    const updatedVotes = (pollData[votesKey] || 0) + 1
    const updatedVolume = (pollData.volume || 0) + amount

    const { error: updateError } = await supabase
      .from('polls')
      .update({
        [poolKey]: updatedPool,
        [votesKey]: updatedVotes,
        volume: updatedVolume,
      })
      .eq('id', poll_id)

    if (updateError) throw updateError

    return NextResponse.json({ vote: vote[0] })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Vote failed' }, { status: 400 })
  }
}