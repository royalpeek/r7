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

export function usePolls(userId?: string | null, initData = '') {
  const [polls, setPolls] = useState<Poll[]>([])
  const [userVotes, setUserVotes] = useState<UserVote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPolls = useCallback(async () => {
    try {
      const response = await fetch('/api/polls')
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to fetch polls')
      setPolls((data.polls || []) as Poll[])
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

      const response = await fetch('/api/me/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to fetch votes')
      setUserVotes((data.votes || []) as UserVote[])
    } catch (err) {
      console.error('fetch votes error:', err)
    }
  }, [initData, userId])

  const refetch = useCallback(async () => {
    await Promise.all([
      fetchPolls(),
      fetchUserVotes(),
    ])
  }, [fetchPolls, fetchUserVotes])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      refetch()
    }, 0)

    const channel = supabase
      .channel('polls-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        () => {
          refetch()
        }
      )
      .subscribe()

    return () => {
      window.clearTimeout(timeout)
      supabase.removeChannel(channel)
    }
  }, [refetch])

  return { polls, userVotes, loading, error, refetch }
}
