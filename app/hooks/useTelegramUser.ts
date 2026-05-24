import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useTelegramUser() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initTelegram = async () => {
      try {
        // wait a bit for telegram to be ready
        await new Promise(resolve => setTimeout(resolve, 2000))

        const tg = (window as any).Telegram?.WebApp
        console.log('telegram object:', tg)

        if (!tg) {
          console.log('telegram not available, using test id')
          setUserId('test-user-123')
          setLoading(false)
          return
        }

        // ready the webapp
        tg.ready()
        console.log('telegram ready called')

        // get init data
        const initData = tg.initData
        const initDataUnsafe = tg.initDataUnsafe
        console.log('initData:', initData)
        console.log('initDataUnsafe:', initDataUnsafe)

        const user = initDataUnsafe?.user
        console.log('user from initDataUnsafe:', user)

        if (!user || !user.id) {
          console.log('no user id found, using test id')
          setUserId('test-user-123')
          setLoading(false)
          return
        }

        const telegramId = user.id.toString()
        const username = user.username || user.first_name || 'unknown'

        console.log('got telegram id:', telegramId, 'username:', username)

        // upsert user in supabase
        const { error } = await supabase
          .from('users')
          .upsert({
            id: telegramId,
            username: username,
          }, { onConflict: 'id' })
          .select()

        if (error) {
          console.error('supabase error:', error)
          throw error
        }

        console.log('user saved to supabase')
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