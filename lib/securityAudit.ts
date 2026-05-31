import type { SupabaseClient } from '@supabase/supabase-js'

type AuditEvent =
  | 'wallet_created'
  | 'telegram_auth_failed'
  | 'telegram_auth_expired'
  | 'emergency_device_bypass_active'
  | 'suspicious_rate_limit'
  | 'admin_endpoint_denied'
  | 'admin_unlock_device'
  | 'withdrawal_requested'
  | 'withdrawal_blocked_by_rate_limit'
  | 'withdrawal_succeeded'
  | 'withdrawal_failed'
  | 'admin_recovery_requested'
  | 'admin_recovery_succeeded'
  | 'admin_recovery_failed'

type AuditDetails = Record<string, string | number | boolean | null | undefined>

function cleanDetails(details: AuditDetails = {}) {
  const blockedWords = ['mnemonic', 'private', 'secret', 'key', 'encrypted']
  const safeDetails: AuditDetails = {}

  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase()
    if (blockedWords.some(word => lowerKey.includes(word))) continue
    safeDetails[key] = value
  }

  return safeDetails
}

export async function recordSecurityAudit(
  supabase: SupabaseClient,
  {
    event,
    actorUserId,
    targetUserId,
    walletAddress,
    txHash,
    status = 'success',
    details = {},
  }: {
    event: AuditEvent
    actorUserId?: string
    targetUserId?: string
    walletAddress?: string
    txHash?: string
    status?: 'success' | 'failed'
    details?: AuditDetails
  }
) {
  const safeDetails = cleanDetails(details)

  const { error } = await supabase
    .from('wallet_audit_logs')
    .insert({
      event,
      actor_user_id: actorUserId || null,
      target_user_id: targetUserId || null,
      wallet_address: walletAddress || null,
      tx_hash: txHash || null,
      status,
      details: safeDetails,
    })

  if (error) {
    console.error('wallet audit insert failed:', {
      event,
      status,
      code: error.code,
      message: error.message,
    })
  }

  const { error: securityEventError } = await supabase
    .from('security_events')
    .insert({
      event,
      actor_user_id: actorUserId || null,
      target_user_id: targetUserId || null,
      wallet_address: walletAddress || null,
      tx_hash: txHash || null,
      status,
      details: safeDetails,
    })

  const missingSecurityEventsTable = securityEventError && (
    securityEventError.code === '42P01' ||
    securityEventError.code === 'PGRST205' ||
    securityEventError.message?.toLowerCase().includes('does not exist') ||
    securityEventError.message?.toLowerCase().includes('could not find the table')
  )

  if (securityEventError && !missingSecurityEventsTable) {
    console.error('security event insert failed:', {
      event,
      status,
      code: securityEventError.code,
      message: securityEventError.message,
    })
  }
}
