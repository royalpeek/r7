import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePolls() {
  const [polls, setPolls] = useState<any[]>([])
  const [userVotes, setUserVotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError

      setPolls(pollsData || [])

      const WebApp = require('@twa-dev/sdk').default
      const user = WebApp.initDataUnsafe.user

      if (user) {
        const uid = user.id.toString()
        setUserId(uid)

        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select('*')
          .eq('telegram_id', uid)

        if (votesError) throw votesError
        setUserVotes(votesData || [])
      }

      setLoading(false)
    } catch (err) {
      setError((err as any).message)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 1000)
    return () => clearInterval(interval)
  }, [])

  return { polls, userVotes, loading, error, refetch: fetchData }
}