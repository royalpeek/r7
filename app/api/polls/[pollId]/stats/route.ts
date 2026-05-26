import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(
  _request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const { pollId } = await context.params
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('votes')
      .select('user_id')
      .eq('poll_id', pollId)

    if (error) throw error

    const stakerCount = new Set(data?.map(vote => vote.user_id) || []).size

    return NextResponse.json({ stakerCount })
  } catch (error) {
    console.error('Error fetching poll stats:', error)
    return NextResponse.json({ error: 'Failed to fetch poll stats' }, { status: 400 })
  }
}
