import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getRequestTelegramUser } from '@/lib/telegramAuth'
import { closeExpiredMarkets } from '@/lib/marketLifecycle'
import { getLatestBlockedLogByUser, getUserDeviceBlockStatus } from '@/lib/deviceSecurity'
import { assertRequestRateLimit } from '@/lib/requestSecurity'

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
    const { supabase, userId } = await requireAdmin(body.initData)

    await assertRequestRateLimit(supabase, {
      key: `admin-overview:${userId}`,
      limit: 30,
      windowSeconds: 60,
      auditEvent: 'suspicious_rate_limit',
      actorUserId: userId,
      details: { phase: 'admin_overview' },
    })

    await closeExpiredMarkets(supabase)

    const [
      usersCountResult,
      pollsCountResult,
      votesCountResult,
      usersResult,
      pollsResult,
      volumeResult,
      walletAuditResult,
      deviceLogsResult,
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
      supabase
        .from('device_security_logs')
        .select('id, event, user_id, device_fingerprint, status, details, created_at')
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

    const users = usersResult.data || []
    const userIds = users.map(user => user.id)
    let devicesByUserId: Record<string, { last_seen_at?: string | null; device_fingerprint?: string | null }> = {}

    let latestBlockedByUser: ReturnType<typeof getLatestBlockedLogByUser> = {}
    let ownerUsernamesById: Record<string, string | null> = {}

    if (userIds.length > 0) {
      const [{ data: devices, error: devicesError }, { data: blockedLogs, error: blockedLogsError }] =
        await Promise.all([
          supabase
            .from('devices')
            .select('user_id, device_fingerprint, last_seen_at')
            .in('user_id', userIds),
          supabase
            .from('device_security_logs')
            .select('user_id, event, details, created_at, status')
            .in('user_id', userIds)
            .eq('status', 'blocked')
            .order('created_at', { ascending: false })
            .limit(200),
        ])

      if (!devicesError && devices) {
        devicesByUserId = Object.fromEntries(
          devices.map(device => [device.user_id, device])
        )
      }

      if (!blockedLogsError && blockedLogs) {
        latestBlockedByUser = getLatestBlockedLogByUser(blockedLogs)
      }

      const ownerUserIds = Array.from(new Set(
        userIds
          .map(userId => getUserDeviceBlockStatus(latestBlockedByUser[userId]).blockedByUserId)
          .filter((value): value is string => Boolean(value))
      ))

      if (ownerUserIds.length > 0) {
        const { data: owners } = await supabase
          .from('users')
          .select('id, username')
          .in('id', ownerUserIds)

        ownerUsernamesById = Object.fromEntries(
          (owners || []).map(owner => [owner.id, owner.username || null])
        )
      }
    }

    const usersWithDevices = users.map(user => {
      const device = devicesByUserId[user.id]
      const blockStatus = getUserDeviceBlockStatus(latestBlockedByUser[user.id])
      const blockedByUserId = blockStatus.blockedByUserId

      return {
        ...user,
        device_registered: Boolean(device?.device_fingerprint),
        device_last_seen_at: device?.last_seen_at || null,
        device_fingerprint: device?.device_fingerprint || null,
        device_block_reason: blockStatus.blockReason,
        device_blocked_by_user_id: blockedByUserId,
        device_blocked_by_username: blockedByUserId
          ? ownerUsernamesById[blockedByUserId] || null
          : null,
      }
    })

    return NextResponse.json({
      stats: {
        totalUsers: usersCountResult.count ?? 0,
        totalPolls: pollsCountResult.count ?? 0,
        totalVotes: votesCountResult.count ?? 0,
        totalVolume,
      },
      users: usersWithDevices,
      polls: pollsResult.data || [],
      walletAuditLogs: walletAuditResult.data || [],
      deviceSecurityLogs: deviceLogsResult.data || [],
    })
  } catch (error) {
    console.error('Admin overview error:', error)
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
}
