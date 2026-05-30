import type { SupabaseClient } from '@supabase/supabase-js'

const memoryCounters = new Map<string, { count: number; resetAt: number }>()

export async function assertRateLimit(
  supabase: SupabaseClient,
  {
    key,
    limit,
    windowSeconds,
  }: {
    key: string
    limit: number
    windowSeconds: number
  }
) {
  const now = Date.now()
  const windowStartMs = now - (now % (windowSeconds * 1000))
  const windowStart = new Date(windowStartMs).toISOString()

  const { data: current, error: readError } = await supabase
    .from('api_rate_limits')
    .select('count')
    .eq('key', key)
    .eq('window_start', windowStart)
    .maybeSingle()

  if (!readError) {
    const nextCount = Number(current?.count || 0) + 1
    const { error: writeError } = await supabase
      .from('api_rate_limits')
      .upsert({
        key,
        window_start: windowStart,
        count: nextCount,
      }, {
        onConflict: 'key,window_start',
      })

    if (!writeError && nextCount <= limit) return
    if (!writeError) throw new Error('Too many attempts. Please wait a bit.')
  }

  const fallback = memoryCounters.get(key)
  if (!fallback || fallback.resetAt <= now) {
    memoryCounters.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    })
    return
  }

  fallback.count += 1
  if (fallback.count > limit) throw new Error('Too many attempts. Please wait a bit.')
}
