import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface TelegramUser {
  id: number
  first_name: string
  username?: string
}

interface TelegramInitDataUnsafe {
  user?: TelegramUser
}

interface TelegramWebApp {
  ready: () => void
  initDataUnsafe: TelegramInitDataUnsafe
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))

        const tg = window.Telegram?.WebApp
        
        if (!tg) {
          console.log('telegram not found, using test id')
          setUserId('test-user-123')
          setLoading(false)
          return
        }

        tg.ready()

        const initDataUnsafe = tg.initDataUnsafe
        const user = initDataUnsafe?.user

        console.log('user from telegram:', user)
        console.log('user.id type:', typeof user?.id)
        console.log('user.id value:', user?.id)

        if (user?.id) {
          const telegramId = String(user.id)
          console.log('saving telegram id:', telegramId)

          const { error } = await supabase
            .from('users')
            .upsert({
              id: telegramId,
              username: user.username || user.first_name || 'user',
              is_creator: false,
            }, { onConflict: 'id' })
            .select()

          if (error) {
            console.error('supabase error:', error)
            throw error
          }

          console.log('success! set userid to:', telegramId)
          setUserId(telegramId)
        } else {
          console.log('no user id found, using test id')
          setUserId('test-user-123')
        }
      } catch (error) {
        console.error('error:', error)
        setUserId('test-user-123')
      } finally {
        setLoading(false)
      }
    }

    initTelegram()
  }, [])

  return { userId, loading }
}