import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type Poll = {
  id: string
  question: string
  yes_votes: number
  no_votes: number
  yes_pool: number
  no_pool: number
  category?: string | null
  status?: string | null
  ends_at: string
  created_at: string
}

export type UserVote = {
  id: string
  poll_id: string
  user_id: string
  direction: 'yes' | 'no'
  amount: number
  claimed_at?: string | null
  payout_amount?: number | null
  created_at?: string
  updated_at?: string
}

let cachedPolls: Poll[] | null = null
let cachedUserVotes: UserVote[] = []
let cachedVotesUserId: string | null = null

export function usePolls(userId?: string | null, initData = '') {
  const channelName = `polls-feed-${useId().replace(/:/g, '')}`
  const [polls, setPolls] = useState<Poll[]>(() => cachedPolls || [])
  const [userVotes, setUserVotes] = useState<UserVote[]>(() => (
    userId && cachedVotesUserId === userId ? cachedUserVotes : []
  ))
  const [loading, setLoading] = useState(() => !cachedPolls)
  const [error, setError] = useState<string | null>(null)
  const pollsRef = useRef<Poll[]>(cachedPolls || [])

  const fetchPolls = useCallback(async (showLoading = false) => {
    try {
      if (showLoading && pollsRef.current.length === 0) setLoading(true)
      setError(null)
      const response = await fetch('/api/polls')
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'failed to fetch polls')
      const nextPolls = (data.polls || []) as Poll[]
      cachedPolls = nextPolls
      pollsRef.current = nextPolls
      setPolls(nextPolls)
      setError(null)
    } catch (err) {
      if (pollsRef.current.length === 0) {
        setError(err instanceof Error ? err.message : 'failed to fetch polls')
      } else {
        console.error('background polls refresh error:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUserVotes = useCallback(async () => {
    try {
      if (!userId || (!initData && process.env.NODE_ENV === 'production')) {
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
      const nextVotes = (data.votes || []) as UserVote[]
      cachedUserVotes = nextVotes
      cachedVotesUserId = userId
      setUserVotes(nextVotes)
    } catch (err) {
      console.error('fetch votes error:', err)
    }
  }, [initData, userId])

  const refetch = useCallback(async (showLoading = false) => {
    await Promise.all([
      fetchPolls(showLoading),
      fetchUserVotes(),
    ])
  }, [fetchPolls, fetchUserVotes])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (userId && cachedVotesUserId === userId) {
        setUserVotes(cachedUserVotes)
      }
      refetch(!cachedPolls)
    }, 0)

    const channel = supabase
      .channel(channelName)
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
  }, [channelName, refetch, userId])

  return { polls, userVotes, loading, error, refetch }
}
