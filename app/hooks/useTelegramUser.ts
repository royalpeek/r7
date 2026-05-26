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

export function useTelegramUser() {
  const [userId, setUserId] = useState<string | null>(null)
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [initData, setInitData] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))

        const tg = window.Telegram?.WebApp
        
        if (!tg) {
          console.log('telegram not found, using test id')
          setUser({
            id: 123,
            first_name: 'Test',
            username: 'test-user',
          })
          setUserId('123')
          const response = await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData: '' }),
          })
          if (response.ok) {
            const data = await response.json()
            setAppUser(data.user)
          }
          setLoading(false)
          return
        }

        tg.ready()
        setInitData(tg.initData)

        const initDataUnsafe = tg.initDataUnsafe
        const user = initDataUnsafe?.user

        console.log('user from telegram:', user)
        console.log('user.id type:', typeof user?.id)
        console.log('user.id value:', user?.id)

        if (user?.id) {
          const telegramId = String(user.id)
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
          setAppUser(data.user)

          console.log('success! set userid to:', telegramId)
          setUserId(telegramId)
        } else {
          console.log('no user id found, using test id')
          setUser(null)
          setAppUser(null)
          setUserId('123')
        }
      } catch (error) {
        console.error('error:', error)
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
    setAppUser(prev => prev ? { ...prev, balance } : prev)
  }

  return { userId, user, appUser, initData, loading, updateBalance }
}
