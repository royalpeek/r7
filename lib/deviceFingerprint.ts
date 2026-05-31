'use client'

const DEVICE_INSTALL_ID_KEY = 'r7_device_install_id'

function getOrCreateInstallId() {
  if (typeof window === 'undefined') return ''

  const existing = window.localStorage.getItem(DEVICE_INSTALL_ID_KEY)
  if (existing) return existing

  const nextId = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(DEVICE_INSTALL_ID_KEY, nextId)
  return nextId
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function stableFingerprintFromInstallId(installId: string) {
  let hash = 2166136261
  const input = `r7:${installId}`

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  const parts = Array.from({ length: 8 }, (_, partIndex) => {
    let part = hash ^ partIndex
    part = Math.imul(part ^ (part >>> 13), 1274126177)
    return (part >>> 0).toString(16).padStart(8, '0')
  })

  return parts.join('').slice(0, 64)
}

export type DeviceFingerprintPayload = {
  fingerprint: string
  installId: string
  osVersion: string
  deviceModel: string
}

export async function getDeviceFingerprintPayload(): Promise<DeviceFingerprintPayload | null> {
  if (typeof window === 'undefined') return null

  const telegramApp = window.Telegram?.WebApp
  const installId = getOrCreateInstallId()
  if (!installId) return null

  const osVersion = [
    telegramApp?.platform || navigator.platform || 'unknown-platform',
    telegramApp?.version || 'unknown-version',
  ].join(':')
  const deviceModel = navigator.userAgent || 'unknown-device'
  const rawFingerprint = `r7:${installId}`

  let fingerprint = ''
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawFingerprint))
    fingerprint = toHex(digest)
  } else {
    fingerprint = stableFingerprintFromInstallId(installId)
  }

  return {
    fingerprint,
    installId,
    osVersion,
    deviceModel,
  }
}
