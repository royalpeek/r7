import type { SupabaseClient } from '@supabase/supabase-js'

export type MarketStatus = 'active' | 'paused' | 'closed' | 'archived' | string | null | undefined

export type MarketLifecycleStatus = 'live' | 'paused' | 'ended' | 'closed' | 'archived'

export function getMarketLifecycleStatus(
  status: MarketStatus,
  endsAt: string | null | undefined,
  now = new Date()
): MarketLifecycleStatus {
  if (status === 'archived') return 'archived'
  if (status === 'closed') return 'closed'
  if (endsAt && new Date(endsAt) <= now) return 'ended'
  if (status === 'paused') return 'paused'
  return 'live'
}

export function getMarketLifecycleLabel(status: MarketLifecycleStatus) {
  if (status === 'live') return 'Live'
  if (status === 'paused') return 'Paused'
  if (status === 'ended') return 'Ended'
  if (status === 'closed') return 'Closed'
  return 'Archived'
}

export async function closeExpiredMarkets(supabase: SupabaseClient) {
  const { error } = await supabase
    .from('polls')
    .update({ status: 'closed' })
    .in('status', ['active', 'paused'])
    .lte('ends_at', new Date().toISOString())

  if (error) throw error
}
