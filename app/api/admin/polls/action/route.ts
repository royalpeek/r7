import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'

const actions = ['pause', 'resume', 'close', 'archive', 'delete'] as const
type PollAction = (typeof actions)[number]

async function requireAdmin(initData: string) {
  const telegramUser = getRequestTelegramUser(initData)
  const userId = String(telegramUser.id)
  const supabase = getSupabaseAdmin()

  const { data: user, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) throw error
  if (user?.role !== 'admin') throw new Error('admin access required')

  return supabase
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pollId = String(body.pollId || '')
    const action = body.action as PollAction
    const supabase = await requireAdmin(body.initData)

    if (!pollId || !actions.includes(action)) {
      return NextResponse.json({ error: 'Invalid market action' }, { status: 400 })
    }

    if (action === 'delete') {
      const historyResult = await supabase
        .from('poll_history')
        .delete()
        .eq('poll_id', pollId)

      if (historyResult.error) throw historyResult.error

      const votesResult = await supabase
        .from('votes')
        .delete()
        .eq('poll_id', pollId)

      if (votesResult.error) throw votesResult.error

      const pollResult = await supabase
        .from('polls')
        .delete()
        .eq('id', pollId)

      if (pollResult.error) throw pollResult.error

      return NextResponse.json({ deleted: true, pollId })
    }

    const updates =
      action === 'pause'
        ? { status: 'paused' }
        : action === 'resume'
          ? { status: 'active' }
          : action === 'archive'
            ? { status: 'archived' }
            : { status: 'closed', ends_at: new Date().toISOString() }

    const { data, error } = await supabase
      .from('polls')
      .update(updates)
      .eq('id', pollId)
      .select('id, question, status, yes_pool, no_pool, yes_votes, no_votes, ends_at, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({ poll: data })
  } catch (error) {
    console.error('Admin poll action error:', error)
    return NextResponse.json({ error: 'Admin market action failed' }, { status: 403 })
  }
}
