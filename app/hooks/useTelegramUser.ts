import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useTelegramUser() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
          const tg = (window as any).Telegram.WebApp
          tg.ready()

          const user = tg.initDataUnsafe?.user
          if (user) {
            // upsert user in supabase
            const { data, error } = await supabase
              .from('users')
              .upsert({
                id: user.id.toString(),
                username: user.username || user.first_name,
              }, { onConflict: 'id' })
              .select()

            if (error) throw error
            setUserId(user.id.toString())
          }
        }
      } catch (error) {
        console.error('telegram auth error:', error)
      } finally {
        setLoading(false)
      }
    }

    initTelegram()
  }, [])

  return { userId, loading }
}