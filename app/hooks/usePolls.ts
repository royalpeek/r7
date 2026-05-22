import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function usePolls() {
  const [polls, setPolls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPolls()

    // subscribe to real-time changes
    const channel = supabase.channel('polls-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'polls',
        },
        (payload) => {
          console.log('poll updated:', payload)
          // update the specific poll in the state
          setPolls(prev =>
            prev.map(poll =>
              poll.id === payload.new.id ? payload.new : poll
            )
          )
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [])

  const fetchPolls = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPolls(data || [])
    } catch (err) {
      setError((err as any).message)
    } finally {
      setLoading(false)
    }
  }

  return { polls, loading, error, refetch: fetchPolls }
}