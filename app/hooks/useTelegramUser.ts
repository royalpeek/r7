import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useTelegramUser() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        if (typeof window !== 'undefined') {
          const tg = (window as any).Telegram?.WebApp
          if (tg) {
            tg.ready()

            // use initDataUnsafe to get user data
            const user = tg.initDataUnsafe?.user
            if (user?.id) {
              console.log('telegram user:', user)
              
              // upsert user in supabase
              const { data, error } = await supabase
                .from('users')
                .upsert({
                  id: user.id.toString(),
                  username: user.username || user.first_name || 'user',
                }, { onConflict: 'id' })
                .select()

              if (error) {
                console.error('supabase error:', error)
                throw error
              }
              
              setUserId(user.id.toString())
              console.log('user id set:', user.id.toString())
            } else {
              console.warn('no telegram user found')
              setLoading(false)
            }
          } else {
            console.warn('telegram web app not available')
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('telegram auth error:', error)
        setLoading(false)
      } finally {
        setLoading(false)
      }
    }

    initTelegram()
  }, [])

  return { userId, loading }
}