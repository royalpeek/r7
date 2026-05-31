import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'

type DeviceLogEvent =
  | 'device_registered'
  | 'login_allowed'
  | 'login_blocked'
  | 'multiple_account_blocked'
  | 'device_mismatch_blocked'
  | 'device_security_disabled'
  | 'admin_device_mismatch_warning'
  | 'admin_login_allowed'
  | 'admin_unlock_device'
  | 'admin_release_shared_device'
  | 'admin_release_shared_phone'
  | 'devices_table_unavailable'
  | 'wallet_creation_checked'
  | 'withdrawal_device_checked'
  | 'user_action_checked'

type DeviceDetails = Record<string, string | number | boolean | null | undefined>

export type DevicePayload = {
  fingerprint?: string
  osVersion?: string | null
  deviceModel?: string | null
}

export type NormalizedDevice = {
  fingerprint: string
  osVersion: string | null
  deviceModel: string | null
}

export function isDeviceSecurityDisabled() {
  return process.env.DISABLE_DEVICE_SECURITY === 'true'
}

function isMissingRelationError(error: PostgrestError | null | undefined) {
  if (!error) return false
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.message?.toLowerCase().includes('does not exist') ||
    error.message?.toLowerCase().includes('could not find the table')
  )
}

function cleanDeviceDetails(details: DeviceDetails = {}) {
  const blockedWords = ['mnemonic', 'private', 'secret', 'key', 'encrypted']
  const safeDetails: DeviceDetails = {}

  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase()
    if (blockedWords.some(word => lowerKey.includes(word))) continue
    safeDetails[key] = value
  }

  return safeDetails
}

export function normalizeDevicePayload(input?: DevicePayload | null): NormalizedDevice {
  const fingerprint = typeof input?.fingerprint === 'string' ? input.fingerprint.trim().toLowerCase() : ''
  const osVersion = typeof input?.osVersion === 'string' ? input.osVersion.trim().slice(0, 160) : null
  const deviceModel = typeof input?.deviceModel === 'string' ? input.deviceModel.trim().slice(0, 240) : null

  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error('One account is allowed per device. Please reopen the app and try again.')
  }

  return { fingerprint, osVersion, deviceModel }
}

export function tryNormalizeDevicePayload(input?: DevicePayload | null) {
  try {
    return normalizeDevicePayload(input)
  } catch {
    return null
  }
}

export async function recordDeviceLog(
  supabase: SupabaseClient,
  {
    event,
    userId,
    fingerprint,
    status = 'success',
    details = {},
  }: {
    event: DeviceLogEvent
    userId?: string
    fingerprint?: string
    status?: 'success' | 'blocked' | 'failed'
    details?: DeviceDetails
  }
) {
  const { error } = await supabase
    .from('device_security_logs')
    .insert({
      event,
      user_id: userId || null,
      device_fingerprint: fingerprint || null,
      status,
      details: cleanDeviceDetails(details),
    })

  if (error) {
    if (isMissingRelationError(error)) return
    console.error('device security log insert failed:', {
      event,
      status,
      code: error.code,
      message: error.message,
    })
  }
}

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<'user' | 'creator' | 'admin' | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data?.role) return null
  if (data.role === 'admin' || data.role === 'creator' || data.role === 'user') {
    return data.role
  }
  return 'user'
}

export async function resolveUserIdentifier(
  supabase: SupabaseClient,
  identifier: string
) {
  const trimmed = identifier.trim()
  if (!trimmed) throw new Error('User identifier is required')

  const { data: byId, error: byIdError } = await supabase
    .from('users')
    .select('id')
    .eq('id', trimmed)
    .maybeSingle()

  if (byIdError) throw byIdError
  if (byId?.id) return byId.id

  const username = trimmed.replace(/^@/, '')
  const { data: byUsername, error: byUsernameError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (byUsernameError) throw byUsernameError
  if (byUsername?.id) return byUsername.id

  throw new Error('User not found')
}

async function upsertUserDevice(
  supabase: SupabaseClient,
  userId: string,
  normalized: NormalizedDevice
) {
  const { data: existing, error: existingError } = await supabase
    .from('devices')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) {
    if (isMissingRelationError(existingError)) {
      await recordDeviceLog(supabase, {
        event: 'devices_table_unavailable',
        userId,
        fingerprint: normalized.fingerprint,
        status: 'failed',
      })
      return
    }
    throw existingError
  }

  if (!existing) {
    const { error: insertError } = await supabase
      .from('devices')
      .insert({
        user_id: userId,
        device_fingerprint: normalized.fingerprint,
        os_version: normalized.osVersion,
        device_model: normalized.deviceModel,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })

    if (insertError) {
      if (isMissingRelationError(insertError)) {
        await recordDeviceLog(supabase, {
          event: 'devices_table_unavailable',
          userId,
          fingerprint: normalized.fingerprint,
          status: 'failed',
        })
        return
      }
      throw insertError
    }

    await recordDeviceLog(supabase, {
      event: 'device_registered',
      userId,
      fingerprint: normalized.fingerprint,
    })
    return
  }

  const { error: updateError } = await supabase
    .from('devices')
    .update({
      device_fingerprint: normalized.fingerprint,
      os_version: normalized.osVersion,
      device_model: normalized.deviceModel,
      last_seen_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateError) {
    if (isMissingRelationError(updateError)) {
      await recordDeviceLog(supabase, {
        event: 'devices_table_unavailable',
        userId,
        fingerprint: normalized.fingerprint,
        status: 'failed',
      })
      return
    }
    throw updateError
  }
}

export type DeviceBlockReason = 'device_taken' | 'phone_taken' | 'mismatch' | null

export type UserDeviceBlockStatus = {
  blockReason: DeviceBlockReason
  blockedByUserId: string | null
}

type DeviceSecurityLogRow = {
  user_id: string | null
  event: string
  details?: { ownerUserId?: string | number | null } | null
  created_at?: string
}

export function getLatestBlockedLogByUser(logs: DeviceSecurityLogRow[]) {
  const latestByUser: Record<string, DeviceSecurityLogRow> = {}

  for (const log of logs) {
    if (!log.user_id || latestByUser[log.user_id]) continue
    latestByUser[log.user_id] = log
  }

  return latestByUser
}

export function getUserDeviceBlockStatus(log?: DeviceSecurityLogRow | null): UserDeviceBlockStatus {
  if (!log) {
    return { blockReason: null, blockedByUserId: null }
  }

  if (log.event === 'multiple_account_blocked') {
    const ownerUserId = log.details?.ownerUserId
    return {
      blockReason: 'device_taken',
      blockedByUserId: ownerUserId != null ? String(ownerUserId) : null,
    }
  }

  if (log.event === 'device_mismatch_blocked') {
    return { blockReason: 'mismatch', blockedByUserId: null }
  }

  return { blockReason: null, blockedByUserId: null }
}

export async function unlockUserDevice(
  supabase: SupabaseClient,
  {
    targetUserId,
    adminUserId,
  }: {
    targetUserId: string
    adminUserId: string
  }
) {
  let clearedOwnerUserId: string | null = null

  const { data: targetDevice, error: targetLookupError } = await supabase
    .from('devices')
    .select('id')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (targetLookupError && !isMissingRelationError(targetLookupError)) throw targetLookupError

  const { error: targetDeleteError } = await supabase
    .from('devices')
    .delete()
    .eq('user_id', targetUserId)

  if (targetDeleteError && !isMissingRelationError(targetDeleteError)) throw targetDeleteError

  const { data: blockedLogs, error: blockedLogsError } = await supabase
    .from('device_security_logs')
    .select('event, details')
    .eq('user_id', targetUserId)
    .eq('status', 'blocked')
    .order('created_at', { ascending: false })
    .limit(10)

  if (blockedLogsError && !isMissingRelationError(blockedLogsError)) throw blockedLogsError

  const sharedDeviceLog = (blockedLogs || []).find(log => log.event === 'multiple_account_blocked')
  const ownerUserId = sharedDeviceLog?.details?.ownerUserId

  if (ownerUserId != null) {
    const ownerId = String(ownerUserId)
    if (ownerId && ownerId !== targetUserId) {
      const { error: ownerDeleteError } = await supabase
        .from('devices')
        .delete()
        .eq('user_id', ownerId)

      if (ownerDeleteError && !isMissingRelationError(ownerDeleteError)) throw ownerDeleteError

      clearedOwnerUserId = ownerId

      await recordDeviceLog(supabase, {
        event: 'admin_release_shared_device',
        userId: targetUserId,
        status: 'success',
        details: {
          adminUserId,
          ownerUserId: ownerId,
        },
      })
    }
  }

  await recordDeviceLog(supabase, {
    event: 'admin_unlock_device',
    userId: targetUserId,
    status: 'success',
    details: {
      adminUserId,
      hadTargetDevice: Boolean(targetDevice),
      clearedOwnerUserId,
      devicesTableMissing: Boolean(
        targetDeleteError && isMissingRelationError(targetDeleteError)
      ),
    },
  })

  return {
    hadTargetDevice: Boolean(targetDevice),
    clearedOwnerUserId,
  }
}

export async function registerOrVerifyDevice(
  supabase: SupabaseClient,
  {
    userId,
    device,
    isNewUser,
  }: {
    userId: string
    device?: DevicePayload | null
    isNewUser: boolean
  }
): Promise<NormalizedDevice | null> {
  if (isDeviceSecurityDisabled()) {
    await recordDeviceLog(supabase, {
      event: 'device_security_disabled',
      userId,
      status: 'success',
      details: { phase: 'login', newUser: isNewUser },
    })
    return null
  }

  const role = await getUserRole(supabase, userId)
  const isAdmin = role === 'admin'

  let normalized: NormalizedDevice
  try {
    normalized = normalizeDevicePayload(device)
  } catch (error) {
    if (isAdmin) {
      await recordDeviceLog(supabase, {
        event: 'admin_login_allowed',
        userId,
        status: 'success',
        details: {
          reason: 'missing_or_invalid_device_payload',
          message: error instanceof Error ? error.message : 'invalid device',
        },
      })
      return null
    }
    throw error
  }

  if (isAdmin) {
    const { data: adminDevice, error: adminDeviceError } = await supabase
      .from('devices')
      .select('device_fingerprint')
      .eq('user_id', userId)
      .maybeSingle()

    if (adminDeviceError && !isMissingRelationError(adminDeviceError)) {
      throw adminDeviceError
    }

    if (
      adminDevice?.device_fingerprint &&
      adminDevice.device_fingerprint !== normalized.fingerprint
    ) {
      await recordDeviceLog(supabase, {
        event: 'admin_device_mismatch_warning',
        userId,
        fingerprint: normalized.fingerprint,
        status: 'success',
        details: {
          previousFingerprint: adminDevice.device_fingerprint,
          newUser: isNewUser,
        },
      })
    }

    await upsertUserDevice(supabase, userId, normalized)
    await recordDeviceLog(supabase, {
      event: 'admin_login_allowed',
      userId,
      fingerprint: normalized.fingerprint,
      details: { newUser: isNewUser },
    })
    return normalized
  }

  const { data: fingerprintOwner, error: fingerprintError } = await supabase
    .from('devices')
    .select('user_id')
    .eq('device_fingerprint', normalized.fingerprint)
    .maybeSingle()

  if (fingerprintError) {
    if (isMissingRelationError(fingerprintError)) {
      await recordDeviceLog(supabase, {
        event: 'devices_table_unavailable',
        userId,
        fingerprint: normalized.fingerprint,
        status: 'failed',
        details: { phase: 'login' },
      })
      return normalized
    }
    throw fingerprintError
  }

  if (fingerprintOwner && fingerprintOwner.user_id !== userId) {
    await recordDeviceLog(supabase, {
      event: 'multiple_account_blocked',
      userId,
      fingerprint: normalized.fingerprint,
      status: 'blocked',
      details: { ownerUserId: fingerprintOwner.user_id },
    })
    throw new Error('Only one account is allowed per device and Telegram ID.')
  }

  const { data: userDevice, error: userDeviceError } = await supabase
    .from('devices')
    .select('device_fingerprint')
    .eq('user_id', userId)
    .maybeSingle()

  if (userDeviceError) {
    if (isMissingRelationError(userDeviceError)) {
      await recordDeviceLog(supabase, {
        event: 'devices_table_unavailable',
        userId,
        fingerprint: normalized.fingerprint,
        status: 'failed',
        details: { phase: 'login' },
      })
      return normalized
    }
    throw userDeviceError
  }

  if (userDevice && userDevice.device_fingerprint !== normalized.fingerprint) {
    await recordDeviceLog(supabase, {
      event: 'device_mismatch_blocked',
      userId,
      fingerprint: normalized.fingerprint,
      status: 'blocked',
      details: { registeredFingerprint: userDevice.device_fingerprint },
    })
    throw new Error('This Telegram account is already linked to another device.')
  }

  if (!userDevice) {
    const { error: insertError } = await supabase
      .from('devices')
      .insert({
        user_id: userId,
        device_fingerprint: normalized.fingerprint,
        os_version: normalized.osVersion,
        device_model: normalized.deviceModel,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })

    if (insertError) {
      if (isMissingRelationError(insertError)) {
        await recordDeviceLog(supabase, {
          event: 'devices_table_unavailable',
          userId,
          fingerprint: normalized.fingerprint,
          status: 'failed',
        })
        return normalized
      }
      throw insertError
    }

    await recordDeviceLog(supabase, {
      event: 'device_registered',
      userId,
      fingerprint: normalized.fingerprint,
      details: { newUser: isNewUser },
    })
  } else {
    const { error: updateError } = await supabase
      .from('devices')
      .update({
        os_version: normalized.osVersion,
        device_model: normalized.deviceModel,
        last_seen_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) throw updateError
  }

  await recordDeviceLog(supabase, {
    event: 'login_allowed',
    userId,
    fingerprint: normalized.fingerprint,
    details: { newUser: isNewUser },
  })

  return normalized
}

export async function assertUserDevice(
  supabase: SupabaseClient,
  {
    userId,
    device,
    event,
  }: {
    userId: string
    device?: DevicePayload | null
    event: Extract<DeviceLogEvent, 'wallet_creation_checked' | 'withdrawal_device_checked' | 'user_action_checked'>
  }
) {
  if (isDeviceSecurityDisabled()) {
    await recordDeviceLog(supabase, {
      event: 'device_security_disabled',
      userId,
      status: 'success',
      details: { phase: event },
    })
    return null
  }

  const role = await getUserRole(supabase, userId)
  if (role === 'admin') {
    const normalized = tryNormalizeDevicePayload(device)
    await recordDeviceLog(supabase, {
      event: 'admin_login_allowed',
      userId,
      fingerprint: normalized?.fingerprint,
      status: 'success',
      details: { phase: event, adminBypass: true },
    })
    return normalized
  }

  const normalized = normalizeDevicePayload(device)
  const { data: userDevice, error } = await supabase
    .from('devices')
    .select('device_fingerprint')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error)) {
      await recordDeviceLog(supabase, {
        event: 'devices_table_unavailable',
        userId,
        fingerprint: normalized.fingerprint,
        status: 'failed',
        details: { phase: event },
      })
      return normalized
    }
    throw error
  }

  if (!userDevice || userDevice.device_fingerprint !== normalized.fingerprint) {
    await recordDeviceLog(supabase, {
      event: 'device_mismatch_blocked',
      userId,
      fingerprint: normalized.fingerprint,
      status: 'blocked',
      details: { phase: event },
    })
    throw new Error('This account can only be used from its registered device.')
  }

  await recordDeviceLog(supabase, {
    event,
    userId,
    fingerprint: normalized.fingerprint,
  })

  return normalized
}
