import type { SupabaseClient } from '@supabase/supabase-js'

type DeviceLogEvent =
  | 'device_registered'
  | 'login_allowed'
  | 'login_blocked'
  | 'multiple_account_blocked'
  | 'device_mismatch_blocked'
  | 'wallet_creation_checked'
  | 'withdrawal_device_checked'
  | 'user_action_checked'

type DeviceDetails = Record<string, string | number | boolean | null | undefined>

export type DevicePayload = {
  fingerprint?: string
  osVersion?: string | null
  deviceModel?: string | null
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

export function normalizeDevicePayload(input?: DevicePayload | null) {
  const fingerprint = typeof input?.fingerprint === 'string' ? input.fingerprint.trim().toLowerCase() : ''
  const osVersion = typeof input?.osVersion === 'string' ? input.osVersion.trim().slice(0, 160) : null
  const deviceModel = typeof input?.deviceModel === 'string' ? input.deviceModel.trim().slice(0, 240) : null

  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error('One account is allowed per device. Please reopen the app and try again.')
  }

  return { fingerprint, osVersion, deviceModel }
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
    console.error('device security log insert failed:', {
      event,
      status,
      code: error.code,
      message: error.message,
    })
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
    device: DevicePayload
    isNewUser: boolean
  }
) {
  const normalized = normalizeDevicePayload(device)

  const { data: fingerprintOwner, error: fingerprintError } = await supabase
    .from('devices')
    .select('user_id')
    .eq('device_fingerprint', normalized.fingerprint)
    .maybeSingle()

  if (fingerprintError) throw fingerprintError

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

  if (userDeviceError) throw userDeviceError

  if (userDevice && userDevice.device_fingerprint !== normalized.fingerprint) {
    await recordDeviceLog(supabase, {
      event: 'device_mismatch_blocked',
      userId,
      fingerprint: normalized.fingerprint,
      status: 'blocked',
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

    if (insertError) throw insertError

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
    device: DevicePayload
    event: Extract<DeviceLogEvent, 'wallet_creation_checked' | 'withdrawal_device_checked' | 'user_action_checked'>
  }
) {
  const normalized = normalizeDevicePayload(device)
  const { data: userDevice, error } = await supabase
    .from('devices')
    .select('device_fingerprint')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  if (!userDevice || userDevice.device_fingerprint !== normalized.fingerprint) {
    await recordDeviceLog(supabase, {
      event: 'device_mismatch_blocked',
      userId,
      fingerprint: normalized.fingerprint,
      status: 'blocked',
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
