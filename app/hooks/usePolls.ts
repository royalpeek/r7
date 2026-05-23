import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePolls(userId?: string | null) {
  const [polls, setPolls] = useState<any[]>([])
  const [userVotes, setUserVotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPolls()
    if (userId) {
      fetchUserVotes()
    }

    // refetch polls and votes every 1 second
    const interval = setInterval(() => {
      fetchPolls()
      if (userId) {
        fetchUserVotes()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [userId])

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

  const fetchUserVotes = async () => {
    try {
      if (!userId) return

      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('user_id', userId)

      if (votesError) throw votesError
      setUserVotes(votesData || [])
    } catch (err) {
      console.error('fetch votes error:', err)
    }
  }

  return { polls, userVotes, loading, error, refetch: fetchPolls }
}