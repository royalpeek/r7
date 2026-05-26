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
          setUser(user)
          console.log('checking if user exists:', telegramId)

          // check if user already exists
          const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('id', telegramId)
            .single()

          if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is fine
            console.error('supabase check error:', checkError)
            throw checkError
          }

          if (!existingUser) {
            // user is new, create them with is_creator: false
            console.log('user is new, creating with is_creator: false')
            const { error: insertError } = await supabase
              .from('users')
              .insert({
                id: telegramId,
                username: user.username || user.first_name || 'user',
                is_creator: false,
              })

            if (insertError) {
              console.error('supabase insert error:', insertError)
              throw insertError
            }
          } else {
            // user already exists, only update username
            console.log('user exists, updating username only')
            const { error: updateError } = await supabase
              .from('users')
              .update({
                username: user.username || user.first_name || 'user',
              })
              .eq('id', telegramId)

            if (updateError) {
              console.error('supabase update error:', updateError)
              throw updateError
            }
          }

          console.log('success! set userid to:', telegramId)
          setUserId(telegramId)
        } else {
          console.log('no user id found, using test id')
          setUser(null)
          setUserId('test-user-123')
        }
      } catch (error) {
        console.error('error:', error)
        setUser(null)
        setUserId('test-user-123')
      } finally {
        setLoading(false)
      }
    }

    initTelegram()
  }, [])

  return { userId, user, loading }
}
