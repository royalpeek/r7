import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, poll_id, direction, amount } = body

    // create vote
    const { data: vote, error: voteError } = await supabase
      .from('votes')
      .insert([{ user_id, poll_id, direction, amount }])
      .select()

    if (voteError) throw voteError

    // update poll totals
    const poolKey = direction === 'yes' ? 'yes_pool' : 'no_pool'
    const votesKey = direction === 'yes' ? 'yes_votes' : 'no_votes'

    const { error: updateError } = await supabase
      .from('polls')
      .update({
        [poolKey]: supabase.rpc('increment', { column: poolKey, amount }),
        [votesKey]: supabase.rpc('increment', { column: votesKey, amount: 1 }),
        volume: supabase.rpc('increment', { column: 'volume', amount }),
      })
      .eq('id', poll_id)

    if (updateError) throw updateError

    return NextResponse.json({ vote: vote[0] })
  } catch (error) {
    console.error('Vote error:', error)
    return NextResponse.json({ error: 'Vote failed' }, { status: 400 })
  }
}