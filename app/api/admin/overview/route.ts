import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { closeExpiredMarkets } from '@/lib/marketLifecycle'

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

  return { supabase, userId }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { supabase } = await requireAdmin(body.initData)
    await closeExpiredMarkets(supabase)

    const [
      usersCountResult,
      pollsCountResult,
      votesCountResult,
      usersResult,
      pollsResult,
      volumeResult,
      walletAuditResult,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('polls').select('*', { count: 'exact', head: true }),
      supabase.from('votes').select('*', { count: 'exact', head: true }),
      supabase
        .from('users')
        .select('id, username, balance, role, is_creator, created_at')
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('polls')
        .select('id, question, status, yes_pool, no_pool, yes_votes, no_votes, ends_at, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('polls')
        .select('yes_pool, no_pool'),
      supabase
        .from('wallet_audit_logs')
        .select('id, event, actor_user_id, target_user_id, wallet_address, tx_hash, status, details, created_at')
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const firstError =
      usersCountResult.error ||
      pollsCountResult.error ||
      votesCountResult.error ||
      usersResult.error ||
      pollsResult.error ||
      volumeResult.error ||
      walletAuditResult.error

    if (firstError) throw firstError

    const totalVolume = (volumeResult.data || []).reduce((sum, poll) => {
      return sum + Number(poll.yes_pool || 0) + Number(poll.no_pool || 0)
    }, 0)

    return NextResponse.json({
      stats: {
        totalUsers: usersCountResult.count ?? 0,
        totalPolls: pollsCountResult.count ?? 0,
        totalVotes: votesCountResult.count ?? 0,
        totalVolume,
      },
      users: usersResult.data || [],
      polls: pollsResult.data || [],
      walletAuditLogs: walletAuditResult.data || [],
    })
  } catch (error) {
    console.error('Admin overview error:', error)
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
}
