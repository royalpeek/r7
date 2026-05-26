import { useEffect, useState } from 'react'

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
}

interface TelegramWebApp {
  ready: () => void
  initData: string
  initDataUnsafe: TelegramInitDataUnsafe
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

export function useTelegramUser() {
  const [userId, setUserId] = useState<string | null>(cachedUserId)
  const [user, setUser] = useState<TelegramUser | null>(cachedTelegramUser)
  const [appUser, setAppUser] = useState<AppUser | null>(cachedAppUser)
  const [initData, setInitData] = useState(cachedInitData)
  const [loading, setLoading] = useState(!cachedInitialized)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        if (!cachedInitialized) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        const tg = window.Telegram?.WebApp
        
        if (!tg) {
          console.log('telegram not found, using test id')
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
            body: JSON.stringify({ initData: '' }),
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

        console.log('user from telegram:', user)
        console.log('user.id type:', typeof user?.id)
        console.log('user.id value:', user?.id)

        if (user?.id) {
          const telegramId = String(user.id)
          cachedTelegramUser = user
          cachedUserId = telegramId
          setUser(user)

          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: tg.initData }),
          })

          if (!response.ok) {
            throw new Error('telegram auth failed')
          }
          const data = await response.json()
          cachedAppUser = data.user
          setAppUser(data.user)

          console.log('success! set userid to:', telegramId)
          setUserId(telegramId)
        } else {
          console.log('no user id found, using test id')
          cachedTelegramUser = null
          cachedAppUser = null
          cachedUserId = '123'
          setUser(null)
          setAppUser(null)
          setUserId('123')
        }
        cachedInitialized = true
      } catch (error) {
        console.error('error:', error)
        cachedTelegramUser = null
        cachedAppUser = null
        cachedUserId = '123'
        cachedInitialized = true
        setUser(null)
        setAppUser(null)
        setUserId('123')
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

  return { userId, user, appUser, initData, loading, updateBalance }
}
