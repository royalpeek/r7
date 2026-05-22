import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePolls() {
  const [polls, setPolls] = useState<any[]>([])
  const [userVotes, setUserVotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPolls()

    // refetch polls every 1 second
    const interval = setInterval(() => {
      fetchPolls()
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const fetchPolls = async () => {
    try {
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError
      setPolls(pollsData || [])
      setLoading(false)
    } catch (err) {
      setError((err as any).message)
      setLoading(false)
    }
  }

  return { polls, userVotes, loading, error, refetch: fetchPolls }
}