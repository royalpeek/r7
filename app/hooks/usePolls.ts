import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Poll = {
  id: string
  question: string
  yes_votes: number
  no_votes: number
  yes_pool: number
  no_pool: number
  ends_at: string
  created_at: string
}

export type UserVote = {
  id: string
  poll_id: string
  user_id: string
  direction: 'yes' | 'no'
  amount: number
  created_at?: string
  updated_at?: string
}

export function usePolls(userId?: string | null) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [userVotes, setUserVotes] = useState<UserVote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPolls = useCallback(async () => {
    try {
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError
      setPolls((pollsData || []) as Poll[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to fetch polls')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUserVotes = useCallback(async () => {
    try {
      if (!userId) {
        setUserVotes([])
        return
      }

      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('user_id', userId)

      if (votesError) throw votesError
      setUserVotes((votesData || []) as UserVote[])
    } catch (err) {
      console.error('fetch votes error:', err)
    }
  }, [userId])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchPolls()
      fetchUserVotes()
    }, 0)

    // refetch polls and votes every 1 second
    const interval = setInterval(() => {
      fetchPolls()
      fetchUserVotes()
    }, 1000)

    return () => {
      window.clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [fetchPolls, fetchUserVotes])

  return { polls, userVotes, loading, error, refetch: fetchPolls }
}
