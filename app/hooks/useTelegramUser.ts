import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useTelegramUser() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        // try to get telegram user
        const tg = (window as any).Telegram?.WebApp
        let user = null

        console.log('telegram available:', !!tg)

        if (tg) {
          tg.ready()
          user = tg.initDataUnsafe?.user
          console.log('telegram user data:', user)
        } else {
          console.log('telegram webapp not found')
        }

        // if no telegram user, use a test id
        const telegramId = user?.id?.toString() || 'test-user-123'
        console.log('using userId:', telegramId)

        // upsert user in supabase
        const { error } = await supabase
          .from('users')
          .upsert({
            id: telegramId,
            username: user?.username || user?.first_name || 'test user',
          }, { onConflict: 'id' })
          .select()

        if (error) {
          console.error('supabase upsert error:', error)
          throw error
        }

        console.log('user saved to supabase with id:', telegramId)
        setUserId(telegramId)
      } catch (error) {
        console.error('auth error:', error)
        setUserId('test-user-123')
      } finally {
        setLoading(false)
      }
    }

    initTelegram()
  }, [])

  return { userId, loading }
}