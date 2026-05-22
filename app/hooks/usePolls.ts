import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePolls() {
  const [polls, setPolls] = useState<any[]>([])
  const [userVotes, setUserVotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const WebApp = require('@twa-dev/sdk').default

    const user = WebApp.initDataUnsafe.user
    if (user) {
      setUserId(user.id.toString())
    }

    fetchData()

    const interval = setInterval(() => {
      fetchData()
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const WebApp = require('@twa-dev/sdk').default
      const user = WebApp.initDataUnsafe.user
      if (!user) {
        setLoading(false)
        return
      }

      const userId = user.id.toString()

      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError

      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('telegram_id', userId)

      if (votesError) throw votesError

      setPolls(pollsData || [])
      setUserVotes(votesData || [])
      setLoading(false)
    } catch (err) {
      setError((err as any).message)
      setLoading(false)
    }
  }

  return { polls, userVotes, loading, error, refetch: fetchData }
}