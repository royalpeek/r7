import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// telegram types
interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

interface TelegramInitDataUnsafe {
  query_id?: string
  user?: TelegramUser
  auth_date?: number
  hash?: string
}

interface TelegramWebApp {
  ready: () => void
  expand: () => void
  initData: string
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
        console.log('=== TELEGRAM INIT START ===')
        
        // wait for telegram
        await new Promise(resolve => setTimeout(resolve, 2000))

        // check window object
        console.log('window.Telegram exists:', !!window.Telegram)
        console.log('window.Telegram.WebApp exists:', !!window.Telegram?.WebApp)

        const tg = window.Telegram?.WebApp
        console.log('tg object:', tg)

        if (!tg) {
          console.log('❌ TELEGRAM WEBAPP NOT FOUND')
          setUserId('test-user-123')
          setLoading(false)
          return
        }

        console.log('✓ Telegram WebApp found')
        
        // call ready
        console.log('calling tg.ready()')
        tg.ready()
        console.log('✓ tg.ready() called')

        // get all available data
        console.log('getting initData...')
        const initData = tg.initData
        console.log('initData:', initData)
        console.log('initData type:', typeof initData)
        console.log('initData length:', initData?.length)

        console.log('getting initDataUnsafe...')
        const initDataUnsafe = tg.initDataUnsafe
        console.log('initDataUnsafe:', JSON.stringify(initDataUnsafe))
        console.log('initDataUnsafe keys:', Object.keys(initDataUnsafe || {}))

        const user = initDataUnsafe?.user
        console.log('user object:', JSON.stringify(user))

        if (!user) {
          console.log('❌ NO USER OBJECT IN initDataUnsafe')
          console.log('full initDataUnsafe:', initDataUnsafe)
          setUserId('test-user-123')
          setLoading(false)
          return
        }

        if (!user.id) {
          console.log('❌ USER HAS NO ID')
          console.log('user object:', user)
          setUserId('test-user-123')
          setLoading(false)
          return
        }

        const telegramId = user.id.toString()
        const username = user.username || user.first_name || 'unknown'

        console.log('✓ GOT TELEGRAM ID:', telegramId)
        console.log('✓ USERNAME:', username)

        // upsert user in supabase
        const { error } = await supabase
          .from('users')
          .upsert({
            id: telegramId,
            username: username,
          }, { onConflict: 'id' })
          .select()

        if (error) {
          console.error('❌ supabase error:', error)
          throw error
        }

        console.log('✓ user saved to supabase')
        console.log('=== TELEGRAM INIT SUCCESS ===')
        setUserId(telegramId)
      } catch (error) {
        console.error('❌ auth error:', error)
        console.log('=== TELEGRAM INIT FAILED ===')
        setUserId('test-user-123')
      } finally {
        setLoading(false)
      }
    }

    initTelegram()
  }, [])

  return { userId, loading }
}