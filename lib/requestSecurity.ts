import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertRateLimit } from '@/lib/rateLimit'
import { recordSecurityAudit } from '@/lib/securityAudit'

export function getRequestFingerprint(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const realIp = request.headers.get('x-real-ip') || ''
  const userAgent = request.headers.get('user-agent') || ''
  const raw = `${forwardedFor.split(',')[0].trim() || realIp || 'unknown'}:${userAgent}`

  return crypto
    .createHash('sha256')
    .update(raw)
    .digest('hex')
    .slice(0, 32)
}

export function classifyTelegramAuthError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('expired telegram auth')) return 'expired_telegram_auth'
  if (message.includes('invalid telegram hash')) return 'invalid_telegram_hash'
  if (message.includes('missing telegram hash')) return 'missing_telegram_hash'
  if (message.includes('missing telegram init data')) return 'missing_telegram_init_data'
  if (message.includes('missing telegram user')) return 'missing_telegram_user'
  if (message.includes('missing telegram_bot_token')) return 'server_telegram_config_missing'
  return 'telegram_auth_failed'
}

export async function assertRequestRateLimit(
  supabase: SupabaseClient,
  {
    key,
    limit,
    windowSeconds,
    auditEvent,
    actorUserId,
    targetUserId,
    details = {},
  }: {
    key: string
    limit: number
    windowSeconds: number
    auditEvent: Parameters<typeof recordSecurityAudit>[1]['event']
    actorUserId?: string
    targetUserId?: string
    details?: Record<string, string | number | boolean | null | undefined>
  }
) {
  try {
    await assertRateLimit(supabase, { key, limit, windowSeconds })
  } catch (error) {
    await recordSecurityAudit(supabase, {
      event: auditEvent,
      actorUserId,
      targetUserId,
      status: 'failed',
      details: {
        ...details,
        rateLimitKey: key,
        reason: error instanceof Error ? error.message : 'rate limit exceeded',
      },
    })
    throw error
  }
}
