import { useEffect, useState } from 'react'
import { DeviceFingerprintPayload, getDeviceFingerprintPayload } from '@/lib/deviceFingerprint'

interface TelegramUser {
  id: number
  first_name: string
  username?: string
}

interface AppUser {
  id: string
  username: string
  balance?: number | null
  is_creator?: boolean
  role?: 'user' | 'creator' | 'admin' | null
}

interface TelegramInitDataUnsafe {
  user?: TelegramUser
  start_param?: string
}

interface TelegramWebApp {
  ready: () => void
  initData: string
  platform?: string
  version?: string
  initDataUnsafe: TelegramInitDataUnsafe
  startParam?: string
  openTelegramLink?: (url: string) => void
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred?: (type: 'error' | 'success' | 'warning') => void
    selectionChanged?: () => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

let cachedTelegramUser: TelegramUser | null = null
let cachedAppUser: AppUser | null = null
let cachedUserId: string | null = null
let cachedInitData = ''
let cachedInitialized = false
let cachedDeviceFingerprint: DeviceFingerprintPayload | null = null
let cachedAuthError: string | null = null

export function useTelegramUser() {
  const [userId, setUserId] = useState<string | null>(cachedUserId)
  const [user, setUser] = useState<TelegramUser | null>(cachedTelegramUser)
  const [appUser, setAppUser] = useState<AppUser | null>(cachedAppUser)
  const [initData, setInitData] = useState(cachedInitData)
  const [deviceFingerprint, setDeviceFingerprint] = useState<DeviceFingerprintPayload | null>(cachedDeviceFingerprint)
  const [authError, setAuthError] = useState<string | null>(cachedAuthError)
  const [loading, setLoading] = useState(!cachedInitialized)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        const device = await getDeviceFingerprintPayload()
        cachedDeviceFingerprint = device
        setDeviceFingerprint(device)
        setAuthError(null)
        cachedAuthError = null

        if (!cachedInitialized) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        const tg = window.Telegram?.WebApp
        
        if (!tg) {
          setUser({
            id: 123,
            first_name: 'Test',
            username: 'test-user',
          })
          cachedTelegramUser = {
            id: 123,
            first_name: 'Test',
            username: 'test-user',
          }
          cachedUserId = '123'
          setUserId('123')
          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: '', device }),
          })
          if (response.ok) {
            const data = await response.json()
            cachedAppUser = data.user
            setAppUser(data.user)
          }
          cachedInitialized = true
          setLoading(false)
          return
        }

        tg.ready()
        cachedInitData = tg.initData
        setInitData(tg.initData)

        const initDataUnsafe = tg.initDataUnsafe
        const user = initDataUnsafe?.user

        if (user?.id) {
          const telegramId = String(user.id)
          cachedTelegramUser = user
          cachedUserId = telegramId
          setUser(user)

          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData, device }),
          })

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || 'telegram auth failed')
          }
          const data = await response.json()
          cachedAppUser = data.user
          setAppUser(data.user)

          setUserId(telegramId)
        } else {
          throw new Error('No Telegram user found')
        }
        cachedInitialized = true
      } catch (error) {
        console.error('error:', error)
        cachedTelegramUser = null
        cachedAppUser = null
        cachedUserId = null
        cachedInitialized = true
        cachedAuthError = error instanceof Error ? error.message : 'Login failed'
        setUser(null)
        setAppUser(null)
        setUserId(null)
        setAuthError(cachedAuthError)
      } finally {
        setLoading(false)
      }
    }

    initTelegram()
  }, [])

  const updateBalance = (balance: number) => {
    setAppUser(prev => {
      const nextUser = prev ? { ...prev, balance } : prev
      cachedAppUser = nextUser
      return nextUser
    })
  }

  return { userId, user, appUser, initData, deviceFingerprint, authError, loading, updateBalance }
}
