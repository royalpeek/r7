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

export type DeviceFingerprintPayload = {
  fingerprint: string
  installId: string
  osVersion: string
  deviceModel: string
}

export async function getDeviceFingerprintPayload(): Promise<DeviceFingerprintPayload | null> {
  if (typeof window === 'undefined' || !crypto.subtle) return null

  const telegramApp = window.Telegram?.WebApp
  const installId = getOrCreateInstallId()
  const osVersion = [
    telegramApp?.platform || navigator.platform || 'unknown-platform',
    telegramApp?.version || 'unknown-version',
  ].join(':')
  const deviceModel = navigator.userAgent || 'unknown-device'
  const rawFingerprint = JSON.stringify({ osVersion, deviceModel, installId })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawFingerprint))

  return {
    fingerprint: toHex(digest),
    installId,
    osVersion,
    deviceModel,
  }
}
